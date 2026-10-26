import { useAnimate, useReducedMotion } from 'framer-motion';
import { useEffect, useEffectEvent, useRef, useState } from 'react';

import type { TicketGrade } from '@entities/ticket';

import type { GameOverHandler, GameSessionProps } from '../model/types';

import { FixedRun } from '../model/gameSession';
import { PAUSE_SOUNDS } from '../model/gameSounds';
import {
    pauseRun,
    progressOf,
    resumeRun,
    type RunPhase,
    scoreOf,
    WORLD_HEIGHT,
    WORLD_WIDTH,
} from '../model/takkoRun';
import { loadTakkoRunImages, TAKKO_RUN_BGM, TAKKO_RUN_SOUNDS } from '../model/takkoRunAssets';
import {
    createPalette,
    drawRun,
    type TakkoRunImages,
    type TakkoRunPalette,
} from '../utils/drawTakkoRun';
import { isInteractive } from '../utils/isInteractive';
import { useLoopingBgm } from './useLoopingBgm';

/** 부딪힌 직후 누르고 있던 점프 키가 곧바로 '다시 하기'를 누르지 않도록 잠깐 막는다 */
const RESTART_GUARD_MS = 400;

const JUMP_KEYS = new Set(['Space', 'ArrowUp']);
const PAUSE_KEYS = new Set(['Escape', 'KeyP']);
/** 점프에 쓰지 않지만 게임 중에 누르면 페이지가 스크롤되는 키 — 기본 동작만 막는다 */
const SCROLL_KEYS = new Set([
    'ArrowDown',
    'ArrowLeft',
    'ArrowRight',
    'PageUp',
    'PageDown',
    'Home',
    'End',
]);

const padScore = (score: number) => String(score).padStart(5, '0');

/** 일시정지를 풀 때 3, 2, 1을 세고 이어 달린다 — 바로 달리다 부딪히지 않게 */
const RESUME_COUNTDOWN = 3;
const COUNTDOWN_STEP_MS = 600;
/** 이 점수마다 점수판이 반짝인다 */
const SCORE_MILESTONE = 100;
/** 스테이지가 오를 때 가운데에 크게 띄워 두는 시간 */
const STAGE_BANNER_MS = 1100;

export type TakkoRunGameProps = GameSessionProps & {
    bestScore?: number;
    onExit: () => void;
    /**
     * 부딪혀 끝났을 때의 점수 — 결과 제출은 쓰는 쪽에서 하고, 받은 응모권 수를 돌려주면 결과 화면에 보여준다
     */
    onGameOver?: GameOverHandler;
};

/**
 * 타꼬런의 엔진 루프·키 입력·점수/스테이지 로직 — 화면은 TakkoRunGame 컴포넌트가 그린다.
 * 캔버스에 매 프레임 한 칸씩 진행하며 그리고, 점수·진행도·배지·안내는 그 위에 겹친다
 */
export function useTakkoRunGame({
    session,
    onRestart,
    onRecordingError,
    bestScore = 0,
    onGameOver,
}: TakkoRunGameProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const scoreRef = useRef<HTMLSpanElement>(null);
    const progressRestRef = useRef<HTMLDivElement>(null);
    /** 마지막으로 화면에 쓴 점수 */
    const shownScoreRef = useRef(-1);
    const progressFaceRef = useRef<HTMLDivElement>(null);
    const restartRef = useRef<HTMLButtonElement>(null);
    const [engine] = useState(() => new FixedRun(session.gameData.seed, session.rules.maxTicks!));
    const runRef = useRef(engine.run);
    const overAtRef = useRef(0);
    const lastFrameAtRef = useRef(0);
    const bgm = useLoopingBgm(TAKKO_RUN_BGM);
    // 게임 시작을 누르고 게임 화면이 열리면 바로 배경 음악을 튼다 (썸네일 화면에서는 나오지 않는다).
    // 브라우저가 막으면 첫 점프 때 다시 튼다
    const { play: playBgm, preloadEffects } = bgm;
    useEffect(() => {
        playBgm();
        preloadEffects([...Object.values(TAKKO_RUN_SOUNDS), ...Object.values(PAUSE_SOUNDS)]);
    }, [playBgm, preloadEffects]);
    /** 마지막으로 소리를 낸 점프 횟수 — 늘어나면 점프음을 낸다 (착지 직전 예약된 점프도 포함) */
    const jumpsRef = useRef(0);

    const [assets, setAssets] = useState<{
        images: TakkoRunImages;
        palette: TakkoRunPalette;
    } | null>(null);
    const images = assets?.images ?? null;
    const [loadFailed, setLoadFailed] = useState(false);
    const [phase, setPhase] = useState<RunPhase>('ready');
    const [lastScore, setLastScore] = useState(0);
    const [best, setBest] = useState(bestScore);
    const [newBest, setNewBest] = useState(false);
    const [stage, setStage] = useState(1);
    /** 스테이지가 올랐을 때 가운데에 잠깐 띄우는 배지 번호 */
    const [stageBanner, setStageBanner] = useState<number | null>(null);
    const stageRef = useRef(1);

    const jumpSound = useEffectEvent(() => bgm.playEffect(TAKKO_RUN_SOUNDS.jump));
    const changeStage = useEffectEvent((next: number) => {
        bgm.playEffect(TAKKO_RUN_SOUNDS.stageUp);
        stageRef.current = next;
        setStage(next);
        setStageBanner(next);
    });
    useEffect(() => {
        if (stageBanner == null) return;
        const timer = setTimeout(() => setStageBanner(null), STAGE_BANNER_MS);
        return () => clearTimeout(timer);
    }, [stageBanner]);
    /** 이번 판으로 받은 응모권 수 — 제출 응답에 있으면 적립 안내 모달을 한 번 띄운다 */
    const [ticketsGranted, setTicketsGranted] = useState(0);
    const [rewardGrade, setRewardGrade] = useState<TicketGrade | null>(null);
    const [rewardOpen, setRewardOpen] = useState(false);
    const playRef = useRef(0);
    /** 일시정지를 풀기 전 남은 카운트다운 (없으면 null) */
    const [countdown, setCountdown] = useState<number | null>(null);
    // 부딪힐 때 화면 흔들기와 점수 100점마다 점수판 반짝임 — 동작 줄이기 설정이면 하지 않는다
    const [shakeScope, animateShake] = useAnimate<HTMLDivElement>();
    const [scoreScope, animateScore] = useAnimate<HTMLDivElement>();
    const reduceMotion = useReducedMotion();
    const milestoneRef = useRef(0);
    const celebrateMilestone = useEffectEvent(() => {
        if (reduceMotion || !scoreScope.current) return;
        void animateScore(
            scoreScope.current,
            { scale: [1, 1.12, 1], filter: ['brightness(1)', 'brightness(1.35)', 'brightness(1)'] },
            { duration: 0.5 },
        );
    });

    useEffect(() => {
        let cancelled = false;
        loadTakkoRunImages()
            .then(
                (loaded) =>
                    !cancelled && setAssets({ images: loaded, palette: createPalette(loaded) }),
            )
            .catch(() => !cancelled && setLoadFailed(true));
        return () => {
            cancelled = true;
        };
    }, []);

    const finish = useEffectEvent((score: number) => {
        overAtRef.current = performance.now();
        // 부딪히면 배경 음악을 작게 줄여 결과 화면에 집중하게 한다
        bgm.duck(0.3);
        bgm.playEffect(TAKKO_RUN_SOUNDS.gameOver);
        if (!reduceMotion && shakeScope.current) {
            void animateShake(
                shakeScope.current,
                { x: [0, -6, 6, -4, 4, -2, 0] },
                { duration: 0.4 },
            );
        }
        setPhase('over');
        setLastScore(score);
        setNewBest(score > best);
        setBest((prev) => Math.max(prev, score));
        // 응답이 늦게 와도 그사이 다시 시작한 판에는 띄우지 않는다
        const play = playRef.current;
        // 저장 요청이 실패하거나 바로 오류를 던져도 게임 화면은 그대로 둔다 (실패 안내는 게임 상세 페이지가 한다)
        Promise.resolve()
            .then(() => onGameOver?.(score, { endTick: engine.endTick, inputs: engine.inputs }))
            .then((result) => {
                if (!result || playRef.current !== play || result.ticketsGranted <= 0) return;
                setTicketsGranted(result.ticketsGranted);
                setRewardGrade(result.reward?.grade ?? null);
                setRewardOpen(true);
            })
            .catch(() => undefined);
    });

    // 그리기 — 화면 크기에 맞춰 캔버스 해상도를 바꾸고 매 프레임 한 칸씩 진행한다
    useEffect(() => {
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');
        if (!assets || !canvas || !ctx) return;
        const { images, palette } = assets;

        const fit = () => {
            const ratio = window.devicePixelRatio || 1;
            canvas.width = Math.round(canvas.clientWidth * ratio);
            canvas.height = Math.round(canvas.clientHeight * ratio);
            ctx.setTransform(canvas.width / WORLD_WIDTH, 0, 0, canvas.height / WORLD_HEIGHT, 0, 0);
            ctx.imageSmoothingQuality = 'high';
        };
        fit();
        const observer = new ResizeObserver(fit);
        observer.observe(canvas);

        let frame = 0;
        lastFrameAtRef.current = performance.now();
        // 연속 프레임 오류는 첫 번째만 남긴다 — 오류가 매 프레임 반복돼도 콘솔이 도배되지 않게
        let frameErrorLogged = false;
        const tick = (now: number) => {
            // 화면이 멎은 시간을 한 프레임에 따라잡아 보이지 않은 장애물과 충돌하지 않게 한다.
            const dt = Math.min(0.1, (now - lastFrameAtRef.current) / 1000);
            lastFrameAtRef.current = now;
            try {
                const run = runRef.current;
                if (engine.advance(dt)) finish(scoreOf(run));
                if (run.stage !== stageRef.current) changeStage(run.stage);
                if (run.jumps > jumpsRef.current) {
                    jumpsRef.current = run.jumps;
                    jumpSound();
                }
                const milestone = Math.floor(scoreOf(run) / SCORE_MILESTONE);
                if (milestone > milestoneRef.current) {
                    milestoneRef.current = milestone;
                    celebrateMilestone();
                }
                // 점수·진행도는 값이 바뀔 때만 화면에 쓴다 — 매 프레임 쓰면 레이아웃 계산이 계속 일어난다.
                // 진행도는 위치(left) 대신 transform으로 옮겨 레이아웃 없이 합성만 하게 한다
                const score = scoreOf(run);
                if (score !== shownScoreRef.current) {
                    shownScoreRef.current = score;
                    if (scoreRef.current) scoreRef.current.textContent = padScore(score);
                    const shift = `translateX(${progressOf(score) * 100}%)`;
                    if (progressRestRef.current) progressRestRef.current.style.transform = shift;
                    if (progressFaceRef.current) progressFaceRef.current.style.transform = shift;
                }
                drawRun(ctx, run, images, palette);
                frameErrorLogged = false;
            } catch (error) {
                if (!frameErrorLogged) {
                    frameErrorLogged = true;
                    console.error('타꼬런 프레임 처리 중 오류가 발생했어요.', error);
                }
            }
            // 한 프레임이 실패해도 다음 프레임 요청은 반드시 이어진다 — 그리기·진행 오류가 루프를 죽이지 않게 한다.
            // finally 절은 React Compiler가 건너뛰므로 성공·실패 뒤 호출로 둔다 (GD-347)
            frame = requestAnimationFrame(tick);
        };
        frame = requestAnimationFrame(tick);
        return () => {
            cancelAnimationFrame(frame);
            observer.disconnect();
        };
    }, [assets, engine]);

    const recordInput = (type: 'press' | 'release') => {
        try {
            engine.input(type);
        } catch (error) {
            pauseRun(runRef.current);
            onRecordingError(error instanceof Error ? error.message : '입력 기록을 중단했습니다.');
        }
    };
    const jump = () => {
        const run = runRef.current;
        if (!images || run.phase === 'over') return;
        recordInput('press');
        if (phase === 'ready') {
            lastFrameAtRef.current = performance.now();
            setPhase('running');
            // 첫 점프(사용자 입력) 때 배경 음악을 시작한다 — 브라우저는 입력 전 소리를 막는다
            bgm.play();
        }
    };

    /**
     * 게임 화면이 창 밖으로 일부 나가 있으면 다 보이도록 최소한만 스크롤한다 (이미 다 보이면 그대로).
     * 게임을 시작할 때·멈출 때·다시 할 때 부른다
     */
    const revealGame = () => {
        containerRef.current?.scrollIntoView({
            block: 'nearest',
            behavior: reduceMotion ? 'auto' : 'smooth',
        });
    };
    // 게임 화면이 열릴 때 한 번 — 동작 줄이기 설정과 상관없이 바로 맞춘다
    useEffect(() => {
        containerRef.current?.scrollIntoView({ block: 'nearest' });
    }, []);

    const restart = () => {
        if (performance.now() - overAtRef.current < RESTART_GUARD_MS) return;
        onRestart();
    };

    /** 일시정지 — 달리는 중이면 멈추고 음악도 멈춘다 (카운트다운 중이면 다시 처음부터 멈춘 상태로) */
    const pause = () => {
        const run = runRef.current;
        if (run.phase === 'paused') {
            setCountdown(null);
            bgm.pause(PAUSE_SOUNDS.pause);
            return;
        }
        if (run.phase !== 'running') return;
        pauseRun(run);
        recordInput('release');
        setPhase('paused');
        revealGame();
        bgm.pause(PAUSE_SOUNDS.pause);
    };

    /** 이어 하기 — 음악을 이어 틀고 3, 2, 1을 센 뒤 달린다 */
    const startResume = () => {
        if (runRef.current.phase !== 'paused' || countdown != null) return;
        bgm.resume(PAUSE_SOUNDS.resume);
        setCountdown(RESUME_COUNTDOWN);
    };
    useEffect(() => {
        if (countdown == null) return;
        const timer = setTimeout(() => {
            if (countdown > 1) {
                setCountdown(countdown - 1);
                return;
            }
            lastFrameAtRef.current = performance.now();
            resumeRun(runRef.current);
            setPhase('running');
            setCountdown(null);
        }, COUNTDOWN_STEP_MS);
        return () => clearTimeout(timer);
    }, [countdown]);

    // 다른 탭이나 창으로 가면 자동으로 일시정지한다 — 돌아오자마자 부딪히지 않게
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

    // 키보드 — 게임이 떠 있는 동안 스페이스바·위 화살표로 점프하고 페이지가 스크롤되지 않게 막는다.
    // Esc·P로 일시정지하고, 멈춘 동안에는 점프 키로 이어 한다
    const handleKey = useEffectEvent((event: KeyboardEvent, down: boolean) => {
        if (isInteractive(event.target) || event.altKey || event.ctrlKey || event.metaKey) return;
        const current = runRef.current.phase;
        if (PAUSE_KEYS.has(event.code)) {
            if (!down || event.repeat || (current !== 'running' && current !== 'paused')) return;
            event.preventDefault();
            if (current === 'running') pause();
            else startResume();
            return;
        }
        if (SCROLL_KEYS.has(event.code)) {
            event.preventDefault();
            return;
        }
        if (!JUMP_KEYS.has(event.code)) return;
        event.preventDefault();
        if (current === 'paused') {
            if (down && !event.repeat) startResume();
            return;
        }
        if (!down) recordInput('release');
        else if (!event.repeat) jump();
    });
    useEffect(() => {
        const onKeyDown = (event: KeyboardEvent) => handleKey(event, true);
        const onKeyUp = (event: KeyboardEvent) => handleKey(event, false);
        window.addEventListener('keydown', onKeyDown);
        window.addEventListener('keyup', onKeyUp);
        return () => {
            window.removeEventListener('keydown', onKeyDown);
            window.removeEventListener('keyup', onKeyUp);
        };
    }, []);

    // 끝나면 '다시 하기'에 초점을 옮겨 키보드로 바로 다시 시작할 수 있게 한다
    useEffect(() => {
        if (phase === 'over') restartRef.current?.focus();
    }, [phase]);

    return {
        containerRef,
        canvasRef,
        scoreRef,
        progressRestRef,
        progressFaceRef,
        restartRef,
        runRef,
        assets,
        images,
        loadFailed,
        phase,
        lastScore,
        best,
        newBest,
        stage,
        stageBanner,
        countdown,
        rewardOpen,
        setRewardOpen,
        ticketsGranted,
        rewardGrade,
        shakeScope,
        scoreScope,
        bgm,
        recordInput,
        jump,
        pause,
        startResume,
        restart,
    };
}
