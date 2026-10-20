import { animate, motion, useAnimate, useMotionValue, useMotionValueEvent } from 'framer-motion';
import { useEffect, useEffectEvent, useRef, useState } from 'react';

import type { TicketGrade } from '@entities/ticket';

import type { ColorWordColorId, ColorWordRound } from '../model/colorWord';
import type { GameOverHandler, GameSessionProps, ValidationData } from '../model/types';

import background from '../assets/colorWord/background.jpg';
import mascotCorrect from '../assets/colorWord/mascot-correct.png';
import mascotIdle from '../assets/colorWord/mascot-idle.png';
import mascotWrong from '../assets/colorWord/mascot-wrong.png';
import wordBoard from '../assets/colorWord/word-board.png';
import { useLoopingBgm } from '../hooks/useLoopingBgm';
import {
    COLOR_WORD_COLORS,
    COLOR_WORD_LIVES,
    createColorWordRound,
    isColorWordCorrect,
} from '../model/colorWord';
import { COLOR_WORD_BGM, COLOR_WORD_SOUNDS } from '../model/colorWordAssets';
import { createXorshift32, ActiveClock } from '../model/gameSession';
import { PAUSE_SOUNDS } from '../model/gameSounds';
import { isInteractive } from '../utils/isInteractive';
import { ColorWordButton } from './ColorWordButton';
import { GameCountdown } from './GameCountdown';
import { GameImageButton } from './GameImageButton';
import { GameKey } from './GameKey';
import {
    GameLives,
    GameOverOverlay,
    GamePauseKeysHint,
    GamePauseOverlay,
    GameStartHint,
    GameStartHintLine,
} from './GameOverlays';
import { GameSpeechBubble } from './GameSpeechBubble';
import { GameTimer } from './GameTimer';
import { RewardDialog } from './RewardDialog';
import { ScoreBoard } from './ScoreBoard';
import { VolumeControl } from './VolumeControl';

type Phase = 'ready' | 'countdown' | 'playing' | 'paused' | 'over';

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
interface Reveal {
    picked: ColorWordColorId | null;
    ok: boolean;
}

const padScore = (score: number) => String(score).padStart(5, '0');
const colorOf = (id: ColorWordColorId) => COLOR_WORD_COLORS.find((color) => color.id === id)!;

/**
 * 글자색깔 맞추기 — 글자 뜻이 아니라 글자에 칠해진 색 버튼을 누른다 (키보드 1~4도 된다).
 * 목숨 3개, 틀리거나 제한 시간이 지나면 하나씩 줄고, 맞힐수록 제한 시간이 짧아진다.
 * 시작·이어 하기 전에 3, 2, 1을 세고, 답을 고르면 타코야끼 표정·판 테두리·결과 칩으로 맞음·틀림을 잠깐 보여 준다.
 * Esc·P나 일시정지 버튼으로 멈추고, 다른 탭·창으로 가면 저절로 멈춘다 (멈춘 동안 시간이 흐르지 않는다)
 */
export function ColorWordGame({
    session,
    onRestart,
    onRecordingError,
    bestScore = 0,
    onExit,
    onGameOver,
}: GameSessionProps & {
    bestScore?: number;
    onExit: () => void;
    onGameOver?: GameOverHandler;
}) {
    const [random] = useState(() => createXorshift32(session.gameData.seed));
    const [phase, setPhase] = useState<Phase>('ready');
    const [countdown, setCountdown] = useState(COUNTDOWN_FROM);
    const [round, setRound] = useState<ColorWordRound>({ word: 'red', ink: 'blue' });
    // 한 문제마다 바뀌는 번호 — 글자 등장 연출과 제한 시간을 처음부터 다시 잰다
    const [roundKey, setRoundKey] = useState(0);
    const [correct, setCorrect] = useState(0);
    const [lives, setLives] = useState(session.rules.initialLives!);
    const [reveal, setReveal] = useState<Reveal | null>(null);
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
    const mascot = !reveal
        ? { key: 'idle', src: mascotIdle }
        : reveal.ok
          ? { key: 'correct', src: mascotCorrect }
          : { key: 'wrong', src: mascotWrong };
    const ink = colorOf(round.ink);
    // 시작 안내·세는 동안·멈춘 동안에는 글자를 가려 미리 볼 수 없게 한다
    const wordOpacity = phase === 'playing' || phase === 'over' ? 1 : 0;

    return (
        <div
            // 판 배경 — 피그마 image 175 (노을 하늘과 구름 위 타코야끼)
            className="border-fg-primary relative aspect-[840/546] w-full overflow-hidden rounded-2xl border-2 bg-cover bg-center shadow-md select-none"
            style={{ backgroundImage: `url(${background})` }}
        >
            <div className="absolute inset-0 flex flex-col">
                {/* 위 — 나가기·소리·일시정지 · 목숨(image 176) · 점수판. 멈춤·세기 화면 위에서도 누를 수 있게 앞에 둔다 */}
                <div
                    className={`flex items-start justify-between gap-3 p-3 ${phase === 'over' ? '' : 'relative z-10'}`}
                >
                    <div className="flex items-start gap-2 sm:gap-3">
                        <GameImageButton kind="exit" size="small" onClick={onExit} />
                        <VolumeControl level={bgm.level} onLevelChange={bgm.setLevel} />
                        {(phase === 'playing' || phase === 'countdown' || phase === 'paused') && (
                            <GameImageButton
                                kind="pause"
                                size="small"
                                onClick={phase === 'paused' ? resume : pause}
                            />
                        )}
                    </div>
                    <GameLives lives={lives} max={COLOR_WORD_LIVES} />
                    <ScoreBoard value={padScore(score)} />
                </div>

                {/* 시간 게이지 — 타코야끼가 남은 시간 끝에 붙어 함께 줄고, 1/3 이하로 남으면 빨개진다 */}
                <div className="mx-6">
                    <GameTimer timeLeft={timeLeft} hurry={hurry && phase !== 'ready'} />
                </div>

                {/* 가운데 — 글자판(image 170) 안에 글자, 아래에 색 버튼 2×2. 틀리면 이 부분이 흔들린다 */}
                <div
                    ref={boardScope}
                    className="flex flex-1 flex-col items-center justify-center gap-[2%] px-3 pb-[12%]"
                >
                    <div className="relative flex aspect-[900/229] w-[min(64%,34rem)] items-center justify-center">
                        <img
                            src={wordBoard}
                            alt=""
                            draggable={false}
                            className="pointer-events-none absolute inset-0 size-full"
                        />
                        {/* 맞히면 다음 글자가 살짝 커지며 나온다. 기본 고딕(프리텐다드) 가장 굵게, 테두리·그림자 없이 깔끔하게.
                            판 그림의 크림색 안쪽이 아래로 치우쳐 있어(높이 28~84%) 글자를 6% 내려 가운데에 맞춘다 */}
                        <motion.p
                            key={roundKey}
                            initial={{ opacity: 0, scale: 0.85 }}
                            animate={{ opacity: wordOpacity, scale: 1 }}
                            transition={{ duration: 0.15 }}
                            className={`relative top-[6%] text-[clamp(1.75rem,5.5vw,3.75rem)] leading-none font-black tracking-tight ${ink.textClass}`}
                        >
                            {word.name}
                        </motion.p>
                    </div>

                    {/* 색 버튼 — 번호는 키보드 단축키 */}
                    <div className="grid w-[min(64%,34rem)] grid-cols-2 gap-x-[3%] gap-y-2">
                        {COLOR_WORD_COLORS.map((color, index) => (
                            <ColorWordButton
                                key={color.id}
                                number={index + 1}
                                name={color.name}
                                disabled={phase !== 'playing'}
                                onPick={() => judge(color.id)}
                            />
                        ))}
                    </div>
                </div>
            </div>

            {/* 오른쪽 아래 타코야끼 — 평소(image 167) · 맞히면 기뻐하고(image 168) · 틀리거나 시간이 지나면 당황한다(image 169). 몸 아래는 판 밖으로 잘린다 */}
            <motion.img
                key={mascot.key}
                src={mascot.src}
                alt=""
                aria-hidden
                draggable={false}
                initial={reveal ? { y: 8, scale: 0.94 } : false}
                animate={{ y: 0, scale: 1 }}
                transition={{ type: 'spring', stiffness: 420, damping: 16 }}
                className="pointer-events-none absolute right-0 -bottom-[5%] w-[24%] origin-bottom [image-rendering:pixelated]"
            />

            {/* 결과 말풍선 — 오른쪽 아래 타코야끼 머리 위 */}
            {reveal && (
                <GameSpeechBubble
                    key={`bubble-${roundKey}`}
                    text={
                        reveal.ok
                            ? '정답!'
                            : reveal.picked === null
                              ? '시간 초과!'
                              : `땡! 정답은 ${ink.name}`
                    }
                    className="bottom-[25%] left-[85%]"
                />
            )}

            {/* 맞힘·틀림 — 게임 판 테두리를 초록·빨강으로 잠깐 바꾼다 */}
            {reveal && (
                <div
                    aria-hidden
                    className={`pointer-events-none absolute inset-0 rounded-2xl border-4 ${reveal.ok ? 'border-semantic-success' : 'border-semantic-error'}`}
                />
            )}

            {phase === 'ready' && (
                <GameStartHint onStart={start}>
                    {/* 조작 — 컴퓨터는 버튼 클릭이나 숫자 키, 터치 기기는 버튼 누르기 */}
                    <GameStartHintLine>
                        <span className="flex items-center gap-1.5 [@media(hover:none)]:hidden">
                            클릭 또는 <GameKey>1</GameKey>~<GameKey>4</GameKey> 색 고르기
                        </span>
                        <span className="hidden [@media(hover:none)]:inline">
                            버튼을 눌러 색 고르기
                        </span>
                        <GamePauseKeysHint />
                    </GameStartHintLine>
                    <GameStartHintLine>목숨 3개 · 맞힐수록 빨라져요</GameStartHintLine>
                </GameStartHint>
            )}

            {/* 3, 2, 1 */}
            {phase === 'countdown' && (
                <div className="bg-surface-inverse/40 absolute inset-0 flex items-center justify-center">
                    <GameCountdown value={countdown} />
                </div>
            )}

            {phase === 'paused' && <GamePauseOverlay onResume={resume} />}

            {phase === 'over' && (
                <GameOverOverlay
                    title="목숨을 다 썼어요!"
                    score={padScore(score)}
                    best={best}
                    newBest={newBest}
                    onRetry={start}
                    onExit={onExit}
                    retryRef={restartRef}
                />
            )}

            <RewardDialog
                open={rewardOpen}
                onOpenChange={setRewardOpen}
                onClosed={() => restartRef.current?.focus()}
                tickets={ticketsGranted}
                grade={rewardGrade}
            />

            {/* 스크린리더 — 문제와 결과를 알린다 */}
            <p aria-live="polite" className="sr-only">
                {phase === 'playing' && !reveal ? `${ink.name}색으로 쓴 ${word.name}` : ''}
                {reveal
                    ? reveal.ok
                        ? '정답'
                        : reveal.picked === null
                          ? '시간 초과'
                          : `틀렸어요. 정답은 ${ink.name}`
                    : ''}
                {phase === 'paused' ? '일시정지' : ''}
                {phase === 'over' ? `게임 끝. ${score}점` : ''}
            </p>
        </div>
    );
}
