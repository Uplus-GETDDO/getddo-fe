import { animate, useAnimate, useMotionValue, useMotionValueEvent } from 'framer-motion';
import { useEffect, useEffectEvent, useRef, useState } from 'react';

import type { TicketGrade } from '@entities/ticket';

import type { ColorWordColorId, ColorWordRound } from '../model/colorWord';
import type { GameOverHandler, GameSessionProps, ValidationData } from '../model/types';

import { COLOR_WORD_COLORS, createColorWordRound, isColorWordCorrect } from '../model/colorWord';
import { COLOR_WORD_BGM, COLOR_WORD_SOUNDS } from '../model/colorWordAssets';
import { createXorshift32, ActiveClock } from '../model/gameSession';
import { PAUSE_SOUNDS } from '../model/gameSounds';
import { isInteractive } from '../utils/isInteractive';
import { useLoopingBgm } from './useLoopingBgm';

export type ColorWordPhase = 'ready' | 'countdown' | 'playing' | 'paused' | 'over';

/** 시작·이어 하기 전에 3, 2, 1을 센다 */
const COUNTDOWN_FROM = 3;
const COUNTDOWN_STEP_MS = 700;
/** 답을 보여 주는 시간 — 맞혀도 다음 문제 전에 숨 돌릴 틈을 두고, 틀리면 정답 칩을 읽을 수 있게 조금 더 길게 */
const REVEAL_CORRECT_MS = 700;
const REVEAL_WRONG_MS = 900;
/** 남은 시간이 이 비율 이하면 시간 막대를 빨갛게 바꾼다 */
const HURRY_RATIO = 1 / 3;
const PAUSE_KEYS = new Set(['Escape', 'KeyP']);

/** 방금 고른 답 — picked가 null이면 시간 초과 */
export interface ColorWordReveal {
    picked: ColorWordColorId | null;
    ok: boolean;
}

const colorOf = (id: ColorWordColorId) => COLOR_WORD_COLORS.find((color) => color.id === id)!;

export type ColorWordGameProps = GameSessionProps & {
    bestScore?: number;
    onExit: () => void;
    onGameOver?: GameOverHandler;
};

/**
 * 글자색깔 맞추기 게임의 상태기·타이머·키 입력·판정 로직 — 화면은 ColorWordGame 컴포넌트가 그린다.
 * 목숨 3개, 틀리거나 제한 시간이 지나면 하나씩 줄고, 맞힐수록 제한 시간이 짧아진다.
 * Esc·P나 일시정지 버튼으로 멈추고, 다른 탭·창으로 가면 저절로 멈춘다 (멈춘 동안 시간이 흐르지 않는다)
 */
export function useColorWordGame({
    session,
    onRestart,
    onRecordingError,
    bestScore = 0,
    onGameOver,
}: ColorWordGameProps) {
    const [random] = useState(() => createXorshift32(session.gameData.seed));
    const [phase, setPhase] = useState<ColorWordPhase>('ready');
    const [countdown, setCountdown] = useState(COUNTDOWN_FROM);
    const [round, setRound] = useState<ColorWordRound>({ word: 'red', ink: 'blue' });
    // 한 문제마다 바뀌는 번호 — 글자 등장 연출과 제한 시간을 처음부터 다시 잰다
    const [roundKey, setRoundKey] = useState(0);
    const [correct, setCorrect] = useState(0);
    const [lives, setLives] = useState(session.rules.initialLives!);
    const [reveal, setReveal] = useState<ColorWordReveal | null>(null);
    const [hurry, setHurry] = useState(false);
    const [best, setBest] = useState(bestScore);
    const [newBest, setNewBest] = useState(false);
    const [rewardOpen, setRewardOpen] = useState(false);
    const [ticketsGranted, setTicketsGranted] = useState(0);
    const [rewardGrade, setRewardGrade] = useState<TicketGrade | null>(null);
    const [boardScope, animateBoard] = useAnimate();
    const restartRef = useRef<HTMLButtonElement>(null);
    // 이번 판 — 보상 응답이 늦게 와도 그사이 다시 시작한 판에는 띄우지 않는다
    const playRef = useRef(0);
    // 답을 보여 주는 동안 멈추라고 하면, 다음 문제로 넘어가면서 멈춘다
    const pauseRequestedRef = useRef(false);
    const [activeClock] = useState(() => new ActiveClock());
    const answersRef = useRef<Extract<ValidationData, { answers: unknown }>['answers']>([]);
    const judgedRef = useRef(false);
    const bgm = useLoopingBgm(COLOR_WORD_BGM);

    // 남은 시간(1 → 0) — 시간 막대 길이이자 제한 시간. 멈추면 이 값에서 그대로 멈춘다
    const timeLeft = useMotionValue(1);
    useMotionValueEvent(timeLeft, 'change', (value) => setHurry(value <= HURRY_RATIO));

    const score = correct * session.rules.pointsPerCorrect!;
    const timeLimit = Math.max(
        session.rules.minimumTimeLimitMs!,
        session.rules.initialTimeLimitMs! - correct * session.rules.timeLimitDecreaseMs!,
    );

    const playSound = (key: keyof typeof COLOR_WORD_SOUNDS) =>
        bgm.playEffect(COLOR_WORD_SOUNDS[key]);

    const start = () => {
        if (phase === 'over') {
            onRestart();
            return;
        }
        answersRef.current = [];
        activeClock.reset();
        judgedRef.current = false;
        playRef.current += 1;
        pauseRequestedRef.current = false;
        // 시작은 항상 키·클릭 입력 안에서 불리므로 여기서 음악을 튼다 (브라우저 자동 재생 제한)
        bgm.play();
        bgm.preloadEffects([...Object.values(COLOR_WORD_SOUNDS), ...Object.values(PAUSE_SOUNDS)]);
        setCorrect(0);
        setLives(session.rules.initialLives!);
        setReveal(null);
        setNewBest(false);
        setRound(createColorWordRound(random));
        setRoundKey((key) => key + 1);
        timeLeft.set(1);
        setCountdown(COUNTDOWN_FROM);
        setPhase('countdown');
    };

    const finish = (finalScore: number) => {
        setPhase('over');
        bgm.duck(0.3);
        playSound('gameOver');
        setNewBest(finalScore > best);
        setBest((prev) => Math.max(prev, finalScore));
        const play = playRef.current;
        // 저장 요청이 실패하거나 바로 오류를 던져도 게임 화면은 그대로 둔다 (실패 안내는 게임 상세 페이지가 한다)
        Promise.resolve()
            .then(() => onGameOver?.(finalScore, { answers: answersRef.current }))
            .then((result) => {
                if (!result || playRef.current !== play || result.ticketsGranted <= 0) return;
                setTicketsGranted(result.ticketsGranted);
                setRewardGrade(result.reward?.grade ?? null);
                setRewardOpen(true);
            })
            .catch(() => undefined);
    };

    /** 일시정지 — 답을 보여 주는 중이면 다음 문제로 넘어가며 멈춘다 */
    const pause = () => {
        if (phase !== 'playing' && phase !== 'countdown') return;
        if (reveal) {
            pauseRequestedRef.current = true;
            return;
        }
        activeClock.pause(performance.now());
        setPhase('paused');
        bgm.pause(PAUSE_SOUNDS.pause);
    };

    /** 이어 하기 — 음악을 이어 틀고 3, 2, 1을 센 뒤 남은 시간부터 다시 잰다 */
    const resume = () => {
        if (phase !== 'paused') return;
        bgm.resume(PAUSE_SOUNDS.resume);
        setCountdown(COUNTDOWN_FROM);
        setPhase('countdown');
    };

    // 답을 고르거나(answer) 시간이 지나면(null) 채점하고, 잠깐 결과를 보여 준다
    const judge = (answer: ColorWordColorId | null) => {
        if (phase !== 'playing' || reveal || judgedRef.current) return;
        if (answersRef.current.length >= 10000) {
            onRecordingError(
                '답변 기록 한도에 도달했습니다. 이 판은 정상 완료로 제출하지 않습니다.',
            );
            return;
        }
        judgedRef.current = true;
        activeClock.pause(performance.now());
        const elapsedMs = Math.min(activeClock.read(performance.now()), timeLimit);
        if (answer === null || elapsedMs >= timeLimit) answer = null;
        answersRef.current.push({
            sequence: answersRef.current.length + 1,
            answer,
            elapsedMs: answer === null ? timeLimit : elapsedMs,
        });
        const ok = answer !== null && isColorWordCorrect(round, answer);
        setReveal({ picked: answer, ok });
        if (ok) {
            setCorrect((n) => n + 1);
            playSound('correct');
            return;
        }
        playSound(answer === null ? 'timeUp' : 'wrong');
        setLives((n) => n - 1);
        // 틀리면 판이 좌우로 짧게 흔들린다 (동작 줄이기 설정이면 흔들리지 않는다)
        if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
            void animateBoard(boardScope.current, { x: [0, -8, 7, -5, 3, 0] }, { duration: 0.35 });
        }
    };

    // 3, 2, 1 — 다 세면 문제를 푼다
    useEffect(() => {
        if (phase !== 'countdown') return;
        const timer = setTimeout(() => {
            if (countdown > 1) setCountdown(countdown - 1);
            else setPhase('playing');
        }, COUNTDOWN_STEP_MS);
        return () => clearTimeout(timer);
    }, [phase, countdown]);

    // 제한 시간 — 남은 만큼만 줄이고, 다 줄면 틀린 것으로 친다. 멈추거나 답을 고르면 그 자리에서 멈춘다
    const timeUp = useEffectEvent(() => judge(null));
    useEffect(() => {
        if (phase !== 'playing' || reveal) return;
        // 멈춘 순간에 시간이 딱 다 됐으면 길이 0짜리 애니메이션을 만들지 않고 바로 시간 초과로 넘긴다
        // (같은 값으로의 애니메이션은 끝 알림이 오지 않을 수 있어, 그대로 두면 문제가 멈춘 채 남는다)
        activeClock.resume(performance.now());
        const remaining = timeLeft.get();
        if (remaining <= 0) {
            const timer = setTimeout(() => timeUp(), 0);
            return () => clearTimeout(timer);
        }
        const controls = animate(timeLeft, 0, {
            duration: (remaining * timeLimit) / 1000,
            ease: 'linear',
            onComplete: () => timeUp(),
        });
        return () => {
            controls.stop();
            activeClock.pause(performance.now());
        };
    }, [phase, reveal, roundKey, timeLimit, timeLeft, activeClock]);

    // 결과를 보여 준 뒤 다음 문제로 (목숨을 다 쓰면 끝)
    const next = useEffectEvent(() => {
        setReveal(null);
        if (lives <= 0) {
            finish(score);
            return;
        }
        activeClock.reset();
        judgedRef.current = false;
        timeLeft.set(1);
        setRound(createColorWordRound(random, round));
        setRoundKey((key) => key + 1);
        if (pauseRequestedRef.current) {
            pauseRequestedRef.current = false;
            setPhase('paused');
            bgm.pause(PAUSE_SOUNDS.pause);
        }
    });
    useEffect(() => {
        if (!reveal) return;
        const timer = setTimeout(() => next(), reveal.ok ? REVEAL_CORRECT_MS : REVEAL_WRONG_MS);
        return () => clearTimeout(timer);
    }, [reveal]);

    // 다른 탭이나 창으로 가면 저절로 멈춘다 — 돌아왔을 때 시간 초과로 목숨이 줄어 있지 않게
    const autoPause = useEffectEvent(() => pause());
    useEffect(() => {
        const onVisibility = () => {
            if (document.hidden) autoPause();
        };
        const onBlur = () => autoPause();
        document.addEventListener('visibilitychange', onVisibility);
        window.addEventListener('blur', onBlur);
        return () => {
            document.removeEventListener('visibilitychange', onVisibility);
            window.removeEventListener('blur', onBlur);
        };
    }, []);

    // 키보드 — 1~4로 고르고, Esc·P로 멈추고, 시작·멈춤 화면에서는 스페이스바·Enter로 시작·이어 한다
    const handleKey = useEffectEvent((event: KeyboardEvent) => {
        // 게임이 떠 있는 동안 스페이스바로 페이지가 내려가지 않게 한다 (버튼에 초점이 있으면 그 버튼을 누르게 둔다)
        if (event.key === ' ' && !isInteractive(event.target)) event.preventDefault();
        if (event.repeat || event.altKey || event.ctrlKey || event.metaKey) return;
        if (PAUSE_KEYS.has(event.code)) {
            if (phase === 'paused') resume();
            else if (phase === 'playing' || phase === 'countdown') pause();
            else return;
            event.preventDefault();
            return;
        }
        if (phase === 'playing') {
            const color = COLOR_WORD_COLORS[Number(event.key) - 1];
            if (!color) return;
            event.preventDefault();
            judge(color.id);
            return;
        }
        if (event.key !== ' ' && event.key !== 'Enter') return;
        if (phase === 'ready') start();
        else if (phase === 'paused') resume();
        else return;
        event.preventDefault();
    });
    useEffect(() => {
        const onKeyDown = (event: KeyboardEvent) => handleKey(event);
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, []);

    useEffect(() => {
        if (phase === 'over') restartRef.current?.focus();
    }, [phase]);

    const word = colorOf(round.word);
    const ink = colorOf(round.ink);

    return {
        phase,
        countdown,
        roundKey,
        score,
        lives,
        reveal,
        hurry,
        timeLeft,
        word,
        ink,
        best,
        newBest,
        rewardOpen,
        setRewardOpen,
        ticketsGranted,
        rewardGrade,
        boardScope,
        restartRef,
        bgm,
        start,
        judge,
        pause,
        resume,
    };
}
