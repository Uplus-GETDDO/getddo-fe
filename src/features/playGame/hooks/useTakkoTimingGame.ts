import { useAnimate, useMotionValue, useTransform } from 'framer-motion';
import { useEffect, useEffectEvent, useRef, useState } from 'react';

import type { TicketGrade } from '@entities/ticket';

import type { TakkoTimingMiss, TakkoTimingResult, TakkoTimingRound } from '../model/takkoTiming';
import type { GameOverHandler, GameSessionProps } from '../model/types';

import { createXorshift32, ActiveClock } from '../model/gameSession';
import { PAUSE_SOUNDS } from '../model/gameSounds';
import {
    createTakkoTimingRound,
    judgeTakkoTiming,
    takkoTimingMissDirection,
    takkoTimingPosition,
    takkoTimingSpeedNotice,
} from '../model/takkoTiming';
import { TAKKO_TIMING_BGM, TAKKO_TIMING_SOUNDS } from '../model/takkoTimingAssets';
import { isInteractive } from '../utils/isInteractive';
import { useLoopingBgm } from './useLoopingBgm';

export type TakkoTimingPhase = 'ready' | 'countdown' | 'playing' | 'paused' | 'over';

/** 시작·이어 하기 전에 3, 2, 1을 센다 */
const COUNTDOWN_FROM = 3;
const COUNTDOWN_STEP_MS = 700;
/** 결과를 보여 주는 시간 — 성공해도 다음 판 전에 숨 돌릴 틈을 두고, 실패는 꽂힌 자리를 0.5초 더 멈춰 보여 준다 */
const REVEAL_SUCCESS_MS = 1100;
const REVEAL_FAIL_MS = 1800;
/** 다음 판 시작에 띄우는 '속도 UP!' 알림을 보여 주는 시간 */
const SPEED_NOTICE_MS = 900;
const PAUSE_KEYS = new Set(['Escape', 'KeyP']);
const STOP_KEYS = new Set([' ', 'Enter']);

/** 방금 꽂은 결과 */
export interface TakkoTimingReveal {
    result: TakkoTimingResult;
    points: number;
    /** 꽂힌 자리 (0~1) — 빗나가면 빨간 표시를 둔다 */
    stopped: number;
    /** 연속 퍼펙트 수 — 두 번째부터 '퍼펙트 ×N'으로 알린다 */
    streak: number;
    /** 빗나간 방향 */
    miss?: TakkoTimingMiss;
}

const percent = (value: number) => `${value * 100}%`;

export type TakkoTimingGameProps = GameSessionProps & {
    bestScore?: number;
    onExit: () => void;
    onGameOver?: GameOverHandler;
};

/**
 * 타꼬 타이밍 맞추기 게임의 상태기·타이머·키 입력·판정 로직 — 화면은 TakkoTimingGame 컴포넌트가 그린다.
 * 구간 안이면 +10점, 가운데 가까이면 퍼펙트 +20점. 한 번이라도 구간 밖에 꽂으면 끝난다 (목숨·제한 시간 없음).
 * 성공할수록 이쑤시개가 빨라지고 금색 구간이 좁아진다
 */
export function useTakkoTimingGame({
    session,
    onRestart,
    onRecordingError,
    bestScore = 0,
    onGameOver,
}: TakkoTimingGameProps) {
    const [random] = useState(() => createXorshift32(session.gameData.seed));
    const [phase, setPhase] = useState<TakkoTimingPhase>('ready');
    const [countdown, setCountdown] = useState(COUNTDOWN_FROM);
    const [round, setRound] = useState<TakkoTimingRound>(() => ({
        center: 0.5,
        width: 0.22,
        sweepMs: 1600,
    }));
    // 한 판마다 바뀌는 번호 — 움직임을 처음부터 다시 잰다
    const [roundKey, setRoundKey] = useState(0);
    const [successes, setSuccesses] = useState(0);
    const [score, setScore] = useState(0);
    const [reveal, setReveal] = useState<TakkoTimingReveal | null>(null);
    const [perfectStreak, setPerfectStreak] = useState(0);
    // 다음 판 시작에 잠깐 띄우는 '속도 UP!' — 판 번호와 함께 둬 다른 판에서 다시 뜨지 않게 한다
    const [speedNotice, setSpeedNotice] = useState<{ roundKey: number; text: string } | null>(null);
    const [best, setBest] = useState(bestScore);
    const [newBest, setNewBest] = useState(false);
    const [rewardOpen, setRewardOpen] = useState(false);
    const [ticketsGranted, setTicketsGranted] = useState(0);
    const [rewardGrade, setRewardGrade] = useState<TicketGrade | null>(null);
    const [boardScope, animateBoard] = useAnimate();
    const restartRef = useRef<HTMLButtonElement>(null);
    // 이번 판 — 보상 응답이 늦게 와도 그사이 다시 시작한 판에는 띄우지 않는다
    const playRef = useRef(0);
    // 결과를 보여 주는 동안 멈추라고 하면, 다음 판으로 넘어가면서 멈춘다
    const pauseRequestedRef = useRef(false);
    // 이번 판에서 흐른 시간(ms) — 일시정지 후 이어 할 때 여기서부터 다시 움직인다
    const elapsedRef = useRef(0);
    const [activeClock] = useState(() => new ActiveClock());
    const tapsRef = useRef<{ sequence: number; elapsedMs: number }[]>([]);
    const judgedRef = useRef(false);
    const bgm = useLoopingBgm(TAKKO_TIMING_BGM);

    // 이쑤시개 위치(0~1) — 매 프레임 바뀌므로 다시 그리지 않고 값만 옮긴다
    const position = useMotionValue(0);
    const runnerX = useTransform(position, percent);

    const playSound = (key: keyof typeof TAKKO_TIMING_SOUNDS) =>
        bgm.playEffect(TAKKO_TIMING_SOUNDS[key]);

    const resetRound = () => {
        elapsedRef.current = 0;
        activeClock.reset();
        judgedRef.current = false;
        position.set(0);
    };

    const start = () => {
        if (phase === 'over') {
            onRestart();
            return;
        }
        tapsRef.current = [];
        playRef.current += 1;
        pauseRequestedRef.current = false;
        // 시작은 항상 키·클릭 입력 안에서 불리므로 여기서 음악을 튼다 (브라우저 자동 재생 제한)
        bgm.play();
        bgm.preloadEffects([...Object.values(TAKKO_TIMING_SOUNDS), ...Object.values(PAUSE_SOUNDS)]);
        setSuccesses(0);
        setScore(0);
        setReveal(null);
        setPerfectStreak(0);
        setSpeedNotice(null);
        setNewBest(false);
        setRound(createTakkoTimingRound(random, 0));
        setRoundKey((key) => key + 1);
        resetRound();
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
            .then(() => onGameOver?.(finalScore, { taps: tapsRef.current }))
            .then((result) => {
                if (!result || playRef.current !== play || result.ticketsGranted <= 0) return;
                setTicketsGranted(result.ticketsGranted);
                setRewardGrade(result.reward?.grade ?? null);
                setRewardOpen(true);
            })
            .catch(() => undefined);
    };

    /** 일시정지 — 결과를 보여 주는 중이면 다음 판으로 넘어가며 멈춘다 */
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

    /** 이어 하기 — 음악을 이어 틀고 3, 2, 1을 센 뒤 멈췄던 자리부터 다시 움직인다 */
    const resume = () => {
        if (phase !== 'paused') return;
        bgm.resume(PAUSE_SOUNDS.resume);
        setCountdown(COUNTDOWN_FROM);
        setPhase('countdown');
    };

    // 꽂기 — 지금 이쑤시개 자리를 채점하고 잠깐 결과를 보여 준다
    const judge = () => {
        if (phase !== 'playing' || reveal || judgedRef.current) return;
        if (tapsRef.current.length >= 10000) {
            onRecordingError(
                '입력 기록 한도에 도달했습니다. 이 판은 정상 완료로 제출하지 않습니다.',
            );
            return;
        }
        judgedRef.current = true;
        activeClock.pause(performance.now());
        const elapsedMs = activeClock.read(performance.now());
        tapsRef.current.push({ sequence: tapsRef.current.length + 1, elapsedMs });
        const stopped = takkoTimingPosition(elapsedMs, round.sweepMs);
        position.set(stopped);
        const result = judgeTakkoTiming(stopped, round);
        const streak = result === 'perfect' ? perfectStreak + 1 : 0;
        setPerfectStreak(streak);
        const points =
            result === 'perfect'
                ? session.rules.perfectPoints!
                : result === 'hit'
                  ? session.rules.points!
                  : 0;
        setReveal({
            result,
            points,
            stopped,
            streak,
            miss: result === 'miss' ? takkoTimingMissDirection(elapsedMs, round) : undefined,
        });
        if (points > 0) {
            setScore((n) => n + points);
            setSuccesses((n) => n + 1);
            playSound('hit');
            if (result === 'perfect') playSound('perfect');
            return;
        }
        playSound('miss');
        // 실패하면 판이 좌우로 짧게 흔들린다 (동작 줄이기 설정이면 흔들리지 않는다)
        if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
            void animateBoard(boardScope.current, { x: [0, -8, 7, -5, 3, 0] }, { duration: 0.35 });
        }
    };

    // 3, 2, 1 — 다 세면 움직이기 시작한다
    useEffect(() => {
        if (phase !== 'countdown') return;
        const timer = setTimeout(() => {
            if (countdown > 1) setCountdown(countdown - 1);
            else setPhase('playing');
        }, COUNTDOWN_STEP_MS);
        return () => clearTimeout(timer);
    }, [phase, countdown]);

    // 움직임 — 매 프레임 이쑤시개 위치를 옮긴다. 제한 시간은 없다.
    // 한 프레임에서 오류가 나도 다음 프레임은 반드시 이어 간다 (타꼬런 tick과 같은 방식)
    useEffect(() => {
        if (phase !== 'playing' || reveal) return;
        activeClock.resume(performance.now());
        let frame = 0;
        let errorLogged = false;
        const tick = () => {
            try {
                const elapsed = activeClock.read(performance.now());
                elapsedRef.current = elapsed;
                position.set(takkoTimingPosition(elapsed, round.sweepMs));
            } catch (error) {
                if (!errorLogged) {
                    errorLogged = true;
                    console.error('타꼬 타이밍 맞추기 프레임 처리 중 오류가 발생했어요.', error);
                }
            }
            // 한 프레임이 실패해도 다음 프레임 요청은 반드시 이어진다.
            // finally 절은 React Compiler가 건너뛰므로 성공·실패 뒤 호출로 둔다 (GD-347)
            frame = requestAnimationFrame(tick);
        };
        frame = requestAnimationFrame(tick);
        return () => {
            cancelAnimationFrame(frame);
            activeClock.pause(performance.now());
        };
    }, [phase, reveal, roundKey, round, position, activeClock]);

    // 결과를 보여 준 뒤 다음 판으로 (빗나가면 끝)
    const next = useEffectEvent(() => {
        const missed = reveal?.result === 'miss';
        setReveal(null);
        if (missed) {
            finish(score);
            return;
        }
        resetRound();
        setRound(createTakkoTimingRound(random, successes, round));
        const notice = takkoTimingSpeedNotice(successes);
        if (notice) setSpeedNotice({ roundKey: roundKey + 1, text: notice });
        setRoundKey((key) => key + 1);
        if (pauseRequestedRef.current) {
            pauseRequestedRef.current = false;
            setPhase('paused');
            bgm.pause(PAUSE_SOUNDS.pause);
        }
    });
    useEffect(() => {
        if (!reveal) return;
        const timer = setTimeout(
            () => next(),
            reveal.points > 0 ? REVEAL_SUCCESS_MS : REVEAL_FAIL_MS,
        );
        return () => clearTimeout(timer);
    }, [reveal]);

    // '속도 UP!'은 잠깐만 — 화면에 보이는 동안만 시간을 잰다 (알림 직후 멈추면 이어 할 때 다시 보인다)
    useEffect(() => {
        if (!speedNotice || phase !== 'playing' || speedNotice.roundKey !== roundKey) return;
        const timer = setTimeout(() => setSpeedNotice(null), SPEED_NOTICE_MS);
        return () => clearTimeout(timer);
    }, [speedNotice, phase, roundKey]);

    // 다른 탭이나 창으로 가면 저절로 멈춘다
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

    // 키보드 — 스페이스바·Enter로 시작·멈추기·이어 하기, Esc·P로 일시정지
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
        if (!STOP_KEYS.has(event.key) || isInteractive(event.target)) return;
        if (phase === 'playing') judge();
        else if (phase === 'ready') start();
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

    return {
        phase,
        countdown,
        round,
        roundKey,
        score,
        reveal,
        speedNotice,
        best,
        newBest,
        rewardOpen,
        setRewardOpen,
        ticketsGranted,
        rewardGrade,
        boardScope,
        restartRef,
        runnerX,
        bgm,
        start,
        judge,
        pause,
        resume,
    };
}
