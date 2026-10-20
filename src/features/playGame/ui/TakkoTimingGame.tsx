import { motion, useAnimate, useMotionValue, useTransform } from 'framer-motion';
import { useEffect, useEffectEvent, useRef, useState } from 'react';

import type { TicketGrade } from '@entities/ticket';

import type { TakkoTimingResult, TakkoTimingRound } from '../model/takkoTiming';
import type { GameOverHandler } from '../model/types';

import mascotCorrect from '../assets/colorWord/mascot-correct.png';
import mascotIdle from '../assets/colorWord/mascot-idle.png';
import mascotWrong from '../assets/colorWord/mascot-wrong.png';
import background from '../assets/takkoTiming/background.jpg';
import gaugePin from '../assets/takkoTiming/gauge-pin.png';
import gaugeSparkle from '../assets/takkoTiming/gauge-sparkle.png';
import gaugeTrack from '../assets/takkoTiming/gauge-track.png';
import gaugeZone from '../assets/takkoTiming/gauge-zone.png';
import toothpick from '../assets/takkoTiming/toothpick.png';
import { useLoopingBgm } from '../hooks/useLoopingBgm';
import { PAUSE_SOUNDS } from '../model/gameSounds';
import {
    createTakkoTimingRound,
    judgeTakkoTiming,
    takkoTimingPoints,
    takkoTimingPosition,
} from '../model/takkoTiming';
import { TAKKO_TIMING_BGM, TAKKO_TIMING_SOUNDS } from '../model/takkoTimingAssets';
import { isInteractive } from '../utils/isInteractive';
import { GameBoardButton } from './GameBoardButton';
import { GameCountdown } from './GameCountdown';
import { GameImageButton } from './GameImageButton';
import { GameKey } from './GameKey';
import {
    GameOverOverlay,
    GamePauseKeysHint,
    GamePauseOverlay,
    GameStartHint,
    GameStartHintLine,
} from './GameOverlays';
import { GameSpeechBubble } from './GameSpeechBubble';
import { RewardDialog } from './RewardDialog';
import { ScoreBoard } from './ScoreBoard';
import { VolumeControl } from './VolumeControl';

type Phase = 'ready' | 'countdown' | 'playing' | 'paused' | 'over';

/** 시작·이어 하기 전에 3, 2, 1을 센다 */
const COUNTDOWN_FROM = 3;
const COUNTDOWN_STEP_MS = 700;
/** 결과를 보여 주는 시간 — 성공해도 다음 판 전에 숨 돌릴 틈을 두고, 실패는 조금 더 길게 */
const REVEAL_SUCCESS_MS = 1100;
const REVEAL_FAIL_MS = 1300;
const PAUSE_KEYS = new Set(['Escape', 'KeyP']);
const STOP_KEYS = new Set([' ', 'Enter']);

/** 방금 꽂은 결과 */
interface Reveal {
    result: TakkoTimingResult;
    points: number;
}

const padScore = (score: number) => String(score).padStart(5, '0');
const percent = (value: number) => `${value * 100}%`;

const RESULT_CHIP: Record<TakkoTimingResult, string> = {
    perfect: '퍼펙트! +20',
    hit: '콕! +10',
    miss: '빗나갔어요!',
};

/**
 * 타꼬 타이밍 맞추기 — 금색 구간에 서 있는 타꼬 위를 이쑤시개가 좌우로 오가고, 타꼬 위에 왔을 때 콕 꽂는다 (화면 클릭·터치, 스페이스바·Enter).
 * 구간 안이면 +10점, 가운데 가까이면 퍼펙트 +20점. 한 번이라도 구간 밖에 꽂으면 끝난다 (목숨·제한 시간 없음).
 * 성공할수록 이쑤시개가 빨라지고 금색 구간이 좁아진다.
 * 시작·이어 하기 3·2·1, 일시정지(Esc·P, 다른 탭·창으로 가면 자동), 결과 표시는 글자색깔 맞추기와 같은 틀이다
 */
export function TakkoTimingGame({
    bestScore = 0,
    onExit,
    onGameOver,
}: {
    bestScore?: number;
    onExit: () => void;
    onGameOver?: GameOverHandler;
}) {
    const [phase, setPhase] = useState<Phase>('ready');
    const [countdown, setCountdown] = useState(COUNTDOWN_FROM);
    const [round, setRound] = useState<TakkoTimingRound>(() =>
        createTakkoTimingRound(Math.random, 0),
    );
    // 한 판마다 바뀌는 번호 — 움직임을 처음부터 다시 잰다
    const [roundKey, setRoundKey] = useState(0);
    const [successes, setSuccesses] = useState(0);
    const [score, setScore] = useState(0);
    const [reveal, setReveal] = useState<Reveal | null>(null);
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
    const bgm = useLoopingBgm(TAKKO_TIMING_BGM);

    // 이쑤시개 위치(0~1) — 매 프레임 바뀌므로 다시 그리지 않고 값만 옮긴다
    const position = useMotionValue(0);
    const runnerX = useTransform(position, percent);

    const playSound = (key: keyof typeof TAKKO_TIMING_SOUNDS) =>
        bgm.playEffect(TAKKO_TIMING_SOUNDS[key]);

    const resetRound = () => {
        elapsedRef.current = 0;
        position.set(0);
    };

    const start = () => {
        playRef.current += 1;
        pauseRequestedRef.current = false;
        // 시작은 항상 키·클릭 입력 안에서 불리므로 여기서 음악을 튼다 (브라우저 자동 재생 제한)
        bgm.play();
        bgm.preloadEffects([...Object.values(TAKKO_TIMING_SOUNDS), ...Object.values(PAUSE_SOUNDS)]);
        setSuccesses(0);
        setScore(0);
        setReveal(null);
        setNewBest(false);
        setRound((prev) => createTakkoTimingRound(Math.random, 0, prev));
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
            .then(() => onGameOver?.(finalScore))
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
        if (phase !== 'playing' || reveal) return;
        const result = judgeTakkoTiming(position.get(), round);
        const points = takkoTimingPoints(result);
        setReveal({ result, points });
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
        const base = performance.now() - elapsedRef.current;
        let frame = 0;
        let errorLogged = false;
        const tick = (now: number) => {
            try {
                const elapsed = now - base;
                elapsedRef.current = elapsed;
                position.set(takkoTimingPosition(elapsed, round.sweepMs));
            } catch (error) {
                if (!errorLogged) {
                    errorLogged = true;
                    console.error('타꼬 타이밍 맞추기 프레임 처리 중 오류가 발생했어요.', error);
                }
            } finally {
                frame = requestAnimationFrame(tick);
            }
        };
        frame = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(frame);
    }, [phase, reveal, roundKey, round, position]);

    // 결과를 보여 준 뒤 다음 판으로 (빗나가면 끝)
    const next = useEffectEvent(() => {
        const missed = reveal?.result === 'miss';
        setReveal(null);
        if (missed) {
            finish(score);
            return;
        }
        resetRound();
        setRound((prev) => createTakkoTimingRound(Math.random, successes, prev));
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

    const mascot = !reveal
        ? { key: 'idle', src: mascotIdle }
        : reveal.points > 0
          ? { key: 'correct', src: mascotCorrect }
          : { key: 'wrong', src: mascotWrong };
    const chip = reveal ? RESULT_CHIP[reveal.result] : null;

    return (
        <div
            // 판 배경 — 피그마 image 188 (타코야끼 가게 카운터). 그림과 같은 16:9로 둬서 양쪽 소품이 잘리지 않게 한다
            className="border-fg-primary relative aspect-video w-full overflow-hidden rounded-2xl border-2 bg-cover bg-center shadow-md select-none"
            style={{ backgroundImage: `url(${background})` }}
        >
            {/* 장면 — 카운터 위 게이지 길(image 195)에 타꼬가 서 있고, 이쑤시개가 위를 오간다. 판을 누르면 꽂는다(위 버튼 제외).
                실패하면 이 장면이 흔들린다. --bar는 게이지 굵기, --taco는 타꼬 너비 */}
            <div
                ref={boardScope}
                className="absolute inset-0 cursor-pointer [--bar:clamp(1.25rem,3.4vw,2.1rem)] [--taco:clamp(3.25rem,10vw,6rem)]"
                onPointerDown={(event) => {
                    if (isInteractive(event.target)) return;
                    if (phase === 'playing') {
                        event.preventDefault();
                        judge();
                    }
                }}
            >
                {/* 게이지 길 — 카운터 위 벽 앞(높이 약 60%)에 띄운다 */}
                <div className="absolute inset-x-[14%] top-[60%] h-(--bar) -translate-y-1/2">
                    {/* 초록 길 — 양 끝 둥근 부분은 그대로, 가운데 점선은 이어 붙여 늘린다 */}
                    <div
                        className="absolute inset-0 border-x-[calc(var(--bar)*0.5)] border-solid"
                        style={{
                            borderImage: `url(${gaugeTrack}) 0 44 fill / 0 calc(var(--bar) * 0.5) round`,
                        }}
                    />
                    {/* 금색 구간 — 타꼬가 서 있는 자리. 양 끝 주황 테두리는 그대로 두고 가운데만 늘린다 */}
                    <motion.div
                        key={`zone-${roundKey}`}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="absolute inset-y-0 border-x-[calc(var(--bar)*0.25)] border-solid"
                        style={{
                            left: percent(round.center - round.width / 2),
                            width: percent(round.width),
                            borderImage: `url(${gaugeZone}) 0 24 fill / 0 calc(var(--bar) * 0.25) stretch`,
                        }}
                    />
                    {/* 퍼펙트 자리 표시 핀 — 금색 구간 가운데 아래 */}
                    <img
                        src={gaugePin}
                        alt=""
                        aria-hidden
                        draggable={false}
                        className="pointer-events-none absolute top-full mt-0.5 h-[calc(var(--bar)*1.2)] w-auto -translate-x-1/2 [image-rendering:pixelated]"
                        style={{ left: percent(round.center) }}
                    />
                    {/* 결과 말풍선 — 타꼬 머리 위(꽂힌 이쑤시개 끝보다 위) */}
                    {chip && (
                        <GameSpeechBubble
                            key={`bubble-${roundKey}`}
                            text={chip}
                            className="bottom-[calc(70%+var(--taco)*2)]"
                            style={{ left: percent(round.center) }}
                        />
                    )}
                    {/* 타꼬 — 금색 구간 가운데에 가만히 서서 기다린다. 판마다 자리가 바뀐다 */}
                    <motion.img
                        key={`${roundKey}-${mascot.key}`}
                        src={mascot.src}
                        alt=""
                        aria-hidden
                        draggable={false}
                        initial={reveal ? { y: -6, scale: 0.9 } : { opacity: 0, y: -8 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        transition={{ type: 'spring', stiffness: 420, damping: 14 }}
                        className="pointer-events-none absolute bottom-[70%] w-(--taco) -translate-x-1/2 [image-rendering:pixelated]"
                        style={{ left: percent(round.center) }}
                    />
                    {/* 퍼펙트 — 타꼬 위에서 반짝임이 톡 터진다 */}
                    {reveal?.result === 'perfect' && (
                        <motion.img
                            src={gaugeSparkle}
                            alt=""
                            aria-hidden
                            draggable={false}
                            initial={{ opacity: 0, scale: 0.3 }}
                            animate={{ opacity: [0, 1, 1, 0], scale: [0.3, 1.2, 1, 1.1] }}
                            transition={{ duration: 0.7 }}
                            className="pointer-events-none absolute bottom-[calc(70%+var(--taco)*0.55)] z-20 h-(--bar) w-auto -translate-x-[140%] [image-rendering:pixelated]"
                            style={{ left: percent(round.center) }}
                        />
                    )}
                    {/* 이쑤시개(피그마 image 196) — 타꼬 위를 좌우로 오가다가, 누르면 그 자리에서 아래로 콕 꽂힌다.
                        세로로 선 이쑤시개 그림(피그마 image 196)의 아래 끝이 이쑤시개 끝이다.
                        길 전체 폭의 틀을 위치만큼 옮겨, 그 왼쪽 끝에 붙은 이쑤시개가 따라가게 한다 */}
                    <motion.div
                        aria-hidden
                        className="pointer-events-none absolute inset-0 z-10 will-change-transform"
                        style={{ x: runnerX }}
                    >
                        <motion.div
                            className="absolute bottom-[calc(70%+var(--taco)*0.95)] left-0 h-[calc(var(--taco)*1.4)] -translate-x-1/2"
                            initial={false}
                            animate={{ y: reveal ? '32%' : '0%' }}
                            transition={
                                reveal
                                    ? { duration: 0.08, ease: 'easeIn' }
                                    : { type: 'spring', stiffness: 300, damping: 22 }
                            }
                        >
                            <img
                                src={toothpick}
                                alt=""
                                draggable={false}
                                className="h-full w-auto drop-shadow-md [image-rendering:pixelated]"
                            />
                        </motion.div>
                    </motion.div>
                </div>

                {/* 꽂기 버튼 — 카운터 앞면 (버튼 자체는 relative라 감싸서 자리를 잡는다) */}
                <div className="absolute bottom-[3%] left-1/2 w-[min(30%,13rem)] -translate-x-1/2">
                    <GameBoardButton
                        disabled={phase !== 'playing'}
                        onClick={() => judge()}
                        className="w-full justify-center gap-2 text-sm sm:text-base"
                    >
                        지금 꽂기!
                        {/* 키 모양 — 글자색깔 맞추기 번호 키와 같은 모양 */}
                        <span
                            aria-hidden
                            className="border-fg-primary bg-surface-page text-caption rounded-md border-2 px-1.5 leading-5 font-extrabold shadow-[0_2px_0_0_var(--color-fg-primary)] [@media(hover:none)]:hidden"
                        >
                            Space
                        </span>
                    </GameBoardButton>
                </div>
            </div>

            {/* 위 — 나가기·소리·일시정지 · 점수판. 아래 장면을 누를 수 있게 빈 곳은 누름을 통과시킨다 */}
            <div className="pointer-events-none absolute inset-0 flex flex-col">
                {/* 멈춤·세기 화면 위에서도 누를 수 있게 앞에 둔다 */}
                <div
                    className={`pointer-events-auto flex items-start justify-between gap-3 p-3 ${phase === 'over' ? '' : 'relative z-10'}`}
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
                    <ScoreBoard value={padScore(score)} />
                </div>
            </div>

            {/* 성공·실패 — 게임 판 테두리를 초록·빨강으로 잠깐 바꾼다 */}
            {reveal && (
                <div
                    aria-hidden
                    className={`pointer-events-none absolute inset-0 rounded-2xl border-4 ${reveal.points > 0 ? 'border-semantic-success' : 'border-semantic-error'}`}
                />
            )}

            {phase === 'ready' && (
                <GameStartHint onStart={start}>
                    <GameStartHintLine>
                        <span className="flex items-center gap-1.5 [@media(hover:none)]:hidden">
                            화면 클릭 또는 <GameKey>Space</GameKey> 꽂기
                        </span>
                        <span className="hidden [@media(hover:none)]:inline">화면을 눌러 꽂기</span>
                        <GamePauseKeysHint />
                    </GameStartHintLine>
                    {/* 점수 규칙(퍼펙트 2배 등)은 게임 방법에 두고, 여기에는 시작 전에 꼭 알아야 할 것만 둔다 */}
                    <GameStartHintLine>한 번 빗나가면 끝!</GameStartHintLine>
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
                    title="빗나갔어요!"
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

            {/* 스크린리더 — 결과를 알린다 */}
            <p aria-live="polite" className="sr-only">
                {phase === 'playing' && !reveal
                    ? '이쑤시개가 움직여요. 타꼬 위에 오면 꽂으세요'
                    : ''}
                {chip ?? ''}
                {phase === 'paused' ? '일시정지' : ''}
                {phase === 'over' ? `게임 끝. ${score}점` : ''}
            </p>
        </div>
    );
}
