import { motion, useAnimate } from 'framer-motion';
import { useEffect, useEffectEvent, useRef, useState } from 'react';

import type { TicketGrade } from '@entities/ticket';

import type { TakkoOrderItemId } from '../model/takkoOrder';
import type { GameOverHandler, GameSessionProps } from '../model/types';

import { useLoopingBgm } from '../hooks/useLoopingBgm';
import { createXorshift32, ActiveClock } from '../model/gameSession';
import { PIXEL_FONT } from '../model/pixelFont';
import {
    TAKKO_ORDER_LIVES,
    TAKKO_ORDER_MENU,
    createTakkoOrder,
    isTakkoOrderPrefix,
    takkoOrderPoints,
    takkoOrderCustomerLabel,
    takkoOrderShowMs,
} from '../model/takkoOrder';
import {
    TAKKO_ORDER_BGM,
    TAKKO_ORDER_CUSTOMERS,
    TAKKO_ORDER_IMAGES,
    TAKKO_ORDER_WRONG_IMAGE,
    TAKKO_ORDER_PROPS,
    TAKKO_ORDER_SCENE,
    TAKKO_ORDER_SOUNDS,
    TAKKO_ORDER_STEAM,
    TAKKO_ORDER_WALL,
} from '../model/takkoOrderAssets';
import { isInteractive } from '../utils/isInteractive';
import { GameCountdown } from './GameCountdown';
import { GameImageButton } from './GameImageButton';
import { GameKey } from './GameKey';
import {
    GameLives,
    GameOverOverlay,
    GameStartHint,
    GameStartHintLine,
    GamePauseOverlay,
} from './GameOverlays';
import { RewardDialog } from './RewardDialog';
import { ScoreBoard } from './ScoreBoard';
import { VolumeControl } from './VolumeControl';

/** ready 시작 안내 · countdown 3,2,1 · showing 주문 보여 주기 · input 내주기 · reveal 맞음/틀림 · over 끝 */
type Phase = 'ready' | 'countdown' | 'showing' | 'input' | 'reveal' | 'over' | 'paused';

const COUNTDOWN_FROM = 3;
const COUNTDOWN_STEP_MS = 700;
/** 결과를 보여 주는 시간 — 틀리면 정답 주문을 읽을 수 있게 더 길게 */
const REVEAL_CORRECT_MS = 900;
const REVEAL_WRONG_MS = 1600;

const padScore = (score: number) => String(score).padStart(5, '0');
const nameOf = (id: TakkoOrderItemId) => TAKKO_ORDER_MENU.find((item) => item.id === id)!.name;

/**
 * 타꼬 주문 — 손님 주문(타코야끼 순서)을 잠깐 보여 주고 가린 뒤, 아래 메뉴 버튼으로 같은 순서대로 내준다 (키보드 1~4도 된다).
 * 맞히면 주문이 하나씩 길어지고, 틀리면 목숨이 하나 줄고 같은 길이의 새 주문을 받는다. 목숨 3개를 다 쓰면 끝.
 * 결과 표시 중에도 멈춰 탭 밖에서 다음 주문의 노출 시간이 소비되지 않게 한다
 */
export function TakkoOrderGame({
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
    const [length, setLength] = useState(session.rules.startLength!);
    const [order, setOrder] = useState<TakkoOrderItemId[]>(() => []);
    const [picked, setPicked] = useState<TakkoOrderItemId[]>([]);
    const [ok, setOk] = useState(false);
    const [customer, setCustomer] = useState(1);
    // 손님 그림 번호 — 새 손님마다 바뀐다
    const [look, setLook] = useState(() =>
        Math.floor(Math.random() * TAKKO_ORDER_CUSTOMERS.length),
    );
    const [score, setScore] = useState(0);
    const [lives, setLives] = useState(session.rules.initialLives!);
    const [best, setBest] = useState(bestScore);
    const [newBest, setNewBest] = useState(false);
    const [rewardOpen, setRewardOpen] = useState(false);
    const [ticketsGranted, setTicketsGranted] = useState(0);
    const [rewardGrade, setRewardGrade] = useState<TicketGrade | null>(null);
    const [boardScope, animateBoard] = useAnimate();
    const restartRef = useRef<HTMLButtonElement>(null);
    // 이번 판 — 보상 응답이 늦게 와도 그사이 다시 시작한 판에는 띄우지 않는다
    const playRef = useRef(0);
    const roundsRef = useRef<{ sequence: number; picks: TakkoOrderItemId[] }[]>([]);
    const pickedRef = useRef<TakkoOrderItemId[]>([]);
    const revealedRef = useRef(false);
    const [showClock] = useState(() => new ActiveClock());
    const pausedPhase = useRef<Phase>('showing');
    const bgm = useLoopingBgm(TAKKO_ORDER_BGM);

    const playSound = (key: keyof typeof TAKKO_ORDER_SOUNDS) =>
        bgm.playEffect(TAKKO_ORDER_SOUNDS[key]);

    const start = () => {
        if (phase === 'over') {
            onRestart();
            return;
        }
        roundsRef.current = [];
        pickedRef.current = [];
        revealedRef.current = false;
        showClock.reset();
        playRef.current += 1;
        // 시작은 항상 키·클릭 입력 안에서 불리므로 여기서 음악을 튼다 (브라우저 자동 재생 제한)
        bgm.play();
        bgm.preloadEffects(Object.values(TAKKO_ORDER_SOUNDS));
        setLength(session.rules.startLength!);
        setOrder(createTakkoOrder(session.rules.startLength!, random));
        setPicked([]);
        setCustomer(1);
        setLook(Math.floor(Math.random() * TAKKO_ORDER_CUSTOMERS.length));
        setScore(0);
        setLives(session.rules.initialLives!);
        setNewBest(false);
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
        // 저장 요청이 실패해도 게임 화면은 그대로 둔다 (실패 안내는 게임 상세 페이지가 한다)
        Promise.resolve()
            .then(() => onGameOver?.(finalScore, { rounds: roundsRef.current }))
            .then((result) => {
                if (!result || playRef.current !== play || result.ticketsGranted <= 0) return;
                setTicketsGranted(result.ticketsGranted);
                setRewardGrade(result.reward?.grade ?? null);
                setRewardOpen(true);
            })
            .catch(() => undefined);
    };

    // 메뉴 하나를 내준다 — 주문 앞부분과 다르면 그 자리에서 틀리고, 끝까지 같으면 맞는다
    const pick = (id: TakkoOrderItemId) => {
        if (phase !== 'input' || revealedRef.current) return;
        if (roundsRef.current.length >= 10000) {
            onRecordingError(
                '주문 기록 한도에 도달했습니다. 이 판은 정상 완료로 제출하지 않습니다.',
            );
            return;
        }
        const next = [...pickedRef.current, id];
        pickedRef.current = next;
        setPicked(next);
        if (!isTakkoOrderPrefix(order, next)) {
            setOk(false);
            revealedRef.current = true;
            roundsRef.current.push({ sequence: roundsRef.current.length + 1, picks: [...next] });
            setPhase('reveal');
            setLives((n) => n - 1);
            playSound('wrong');
            // 틀리면 주문서가 좌우로 짧게 흔들린다 (동작 줄이기 설정이면 흔들리지 않는다)
            if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
                void animateBoard(
                    boardScope.current,
                    { x: [0, -8, 7, -5, 3, 0] },
                    { duration: 0.35 },
                );
            }
            return;
        }
        if (next.length === order.length) {
            setOk(true);
            revealedRef.current = true;
            roundsRef.current.push({ sequence: roundsRef.current.length + 1, picks: [...next] });
            setPhase('reveal');
            setScore((n) => n + takkoOrderPoints(order.length));
            playSound('correct');
        }
    };

    // 3, 2, 1 — 다 세면 첫 주문을 보여 준다
    useEffect(() => {
        if (phase !== 'countdown') return;
        const timer = setTimeout(() => {
            if (countdown > 1) setCountdown(countdown - 1);
            else setPhase('showing');
        }, COUNTDOWN_STEP_MS);
        return () => clearTimeout(timer);
    }, [phase, countdown]);

    // 주문을 보여 준 뒤 가리고 내주기로
    useEffect(() => {
        if (phase !== 'showing') return;
        showClock.resume(performance.now());
        const timer = setTimeout(
            () => setPhase('input'),
            Math.max(0, takkoOrderShowMs(order.length) - showClock.read(performance.now())),
        );
        return () => {
            clearTimeout(timer);
            showClock.pause(performance.now());
        };
    }, [phase, order, showClock]);

    // 결과를 보여 준 뒤 다음 손님으로 (목숨을 다 쓰면 끝)
    const next = useEffectEvent(() => {
        if (lives <= 0) {
            finish(score);
            return;
        }
        const nextLength = ok ? Math.min(session.rules.maxLength!, length + 1) : length;
        setLength(nextLength);
        setOrder(createTakkoOrder(nextLength, random));
        setPicked([]);
        pickedRef.current = [];
        revealedRef.current = false;
        if (ok) {
            setCustomer((n) => n + 1);
            // 바로 앞 손님과 다른 그림으로
            setLook(
                (prev) =>
                    (prev + 1 + Math.floor(Math.random() * (TAKKO_ORDER_CUSTOMERS.length - 1))) %
                    TAKKO_ORDER_CUSTOMERS.length,
            );
        }
        showClock.reset();
        setPhase('showing');
    });
    useEffect(() => {
        if (phase !== 'reveal') return;
        const timer = setTimeout(() => next(), ok ? REVEAL_CORRECT_MS : REVEAL_WRONG_MS);
        return () => clearTimeout(timer);
    }, [phase, ok]);

    const pause = () => {
        if (
            phase === 'showing' ||
            phase === 'input' ||
            phase === 'countdown' ||
            phase === 'reveal'
        ) {
            pausedPhase.current = phase;
            showClock.pause(performance.now());
            setPhase('paused');
            bgm.pause();
        }
    };
    const resume = () => {
        if (phase === 'paused') {
            setPhase(pausedPhase.current);
            bgm.resume();
        }
    };
    const autoPause = useEffectEvent(() => pause());
    useEffect(() => {
        const hidden = () => {
            if (document.hidden) autoPause();
        };
        const blur = () => autoPause();
        document.addEventListener('visibilitychange', hidden);
        window.addEventListener('blur', blur);
        return () => {
            document.removeEventListener('visibilitychange', hidden);
            window.removeEventListener('blur', blur);
        };
    }, []);

    // 키보드 — 1~4로 메뉴를 내주고, 시작 화면에서는 스페이스바·Enter로 시작한다
    const handleKey = useEffectEvent((event: KeyboardEvent) => {
        // 게임이 떠 있는 동안 스페이스바로 페이지가 내려가지 않게 한다 (버튼에 초점이 있으면 그 버튼을 누르게 둔다)
        if (event.key === ' ' && !isInteractive(event.target)) event.preventDefault();
        if (event.repeat || event.altKey || event.ctrlKey || event.metaKey) return;
        if (event.code === 'Escape' || event.code === 'KeyP') {
            event.preventDefault();
            if (phase === 'paused') resume();
            else pause();
            return;
        }
        if (phase === 'paused' && (event.key === ' ' || event.key === 'Enter')) {
            event.preventDefault();
            resume();
            return;
        }
        if (phase === 'input') {
            const item = TAKKO_ORDER_MENU[Number(event.key) - 1];
            if (!item) return;
            event.preventDefault();
            pick(item.id);
            return;
        }
        if (phase === 'ready' && (event.key === ' ' || event.key === 'Enter')) {
            event.preventDefault();
            start();
        }
    });
    useEffect(() => {
        const onKeyDown = (event: KeyboardEvent) => handleKey(event);
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, []);

    useEffect(() => {
        if (phase === 'over') restartRef.current?.focus();
    }, [phase]);

    // 주문 말풍선 — 보여 주는 동안과 결과를 보여 줄 때는 주문, 내주는 동안은 가린 칸(?)
    const showOrder = phase === 'showing' || phase === 'reveal';
    const customerSrc = TAKKO_ORDER_CUSTOMERS[look % TAKKO_ORDER_CUSTOMERS.length]!;
    const playing = phase === 'showing' || phase === 'input' || phase === 'reveal';
    const line =
        phase === 'showing'
            ? '이렇게 주세요!'
            : phase === 'input'
              ? '순서대로 주세요'
              : ok
                ? '잘 먹을게요!'
                : '주문이 달라요!';

    return (
        <div
            // 타코야끼 가게 — 타꼬 타이밍과 같은 들보·미색 벽에 노렌·문어 장식·선반, 아래 나무 카운터(그림이라 다크에서도 라이트 색)
            className="force-light border-fg-primary relative aspect-[840/546] w-full overflow-hidden rounded-2xl border-2 bg-cover bg-top shadow-md select-none"
            style={{ backgroundImage: `url(${TAKKO_ORDER_WALL.wall})` }}
        >
            {/* 문어 장식(image 248) — 노렌 양옆 들보에 매달아 둔다 */}
            {(['left-[30%]', 'right-[30%]'] as const).map((side) => (
                <img
                    key={side}
                    src={TAKKO_ORDER_WALL.octopus}
                    alt=""
                    aria-hidden
                    draggable={false}
                    className={`pointer-events-none absolute top-[5%] ${side} w-[4.5%] [image-rendering:pixelated]`}
                />
            ))}
            {/* 노렌(image 245) — 위 가운데 */}
            <img
                src={TAKKO_ORDER_SCENE.noren}
                alt=""
                aria-hidden
                draggable={false}
                className="pointer-events-none absolute top-[7%] left-1/2 w-[30%] -translate-x-1/2 [image-rendering:pixelated]"
            />
            {/* 선반(image 245) — 오른쪽 벽, 작게 */}
            <img
                src={TAKKO_ORDER_SCENE.shelf}
                alt=""
                aria-hidden
                draggable={false}
                className="pointer-events-none absolute top-[28%] right-[3%] w-[24%] [image-rendering:pixelated]"
            />

            {/* 창문(image 251) — 손님 뒤 벽. 말풍선에 가려지지 않게 손님 오른쪽 어깨 뒤로 비켜 둔다 */}
            <img
                src={TAKKO_ORDER_WALL.window}
                alt=""
                aria-hidden
                draggable={false}
                className="pointer-events-none absolute top-[28%] left-[23%] w-[19%] [image-rendering:pixelated]"
            />

            {/* 손님 — 왼쪽, 카운터 뒤. 모든 손님을 같은 키로 맞춰 발이 늘 카운터에 가린다 (키가 작아도 떠 보이지 않게).
                게임이 끝나도 마지막 손님은 그대로 남긴다 */}
            {(playing || phase === 'over') && (
                <motion.img
                    key={`customer-${customer}`}
                    src={customerSrc}
                    alt=""
                    aria-hidden
                    draggable={false}
                    initial={{ y: '20%', opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ type: 'spring', stiffness: 260, damping: 20 }}
                    className="pointer-events-none absolute bottom-[13%] left-[11%] w-[21%] [image-rendering:pixelated]"
                />
            )}

            {/* 나무 카운터(image 246) — 양끝이 마감된 한 장이라 판보다 넓게 깔아 끝을 판 밖으로 뺀다. 손님 아래쪽을 가린다 */}
            <img
                src={TAKKO_ORDER_SCENE.counter}
                alt=""
                aria-hidden
                draggable={false}
                className="pointer-events-none absolute -bottom-[1%] left-[-12%] w-[124%] max-w-none [image-rendering:pixelated]"
            />

            {/* 카운터 위 소품 — 꼬치 통(image 250)은 손님 앞 왼쪽 끝, 소스 받침과 포장 상자는 오른쪽 끝에 겹쳐 모은다.
                윗면 안쪽(뒤)은 조금 위에, 바깥쪽(앞)은 조금 아래에 두어 깊이를 준다. 접시는 피한다 */}
            <img
                src={TAKKO_ORDER_PROPS.sticks}
                alt=""
                aria-hidden
                draggable={false}
                className="pointer-events-none absolute bottom-[21%] left-[3.5%] h-[10%] w-auto [image-rendering:pixelated]"
            />
            <img
                src={TAKKO_ORDER_PROPS.sauces}
                alt=""
                aria-hidden
                draggable={false}
                className="pointer-events-none absolute right-[9%] bottom-[23.5%] h-[8.5%] w-auto [image-rendering:pixelated]"
            />
            <img
                src={TAKKO_ORDER_PROPS.boxes}
                alt=""
                aria-hidden
                draggable={false}
                className="pointer-events-none absolute right-[3%] bottom-[21%] h-[9.5%] w-auto [image-rendering:pixelated]"
            />

            {/* 주문 말풍선 — 손님 머리 위, 다른 게임 말풍선과 같은 도트 그림체(바탕은 가게 나무색과 어울리는 연한 브론즈). 틀리면 흔들리며 정답 주문을 보여 준다 */}
            {playing && (
                <div
                    ref={boardScope}
                    className="border-fg-primary bg-grade-bronze-soft absolute bottom-[58%] left-[21.5%] flex -translate-x-1/2 flex-col items-center gap-1 rounded-md border-[3px] px-2 py-1.5 shadow-[3px_3px_0_0_var(--color-fg-primary)] sm:px-3 sm:py-2"
                >
                    <p
                        className={`text-fg-secondary text-[0.625rem] whitespace-nowrap sm:text-xs ${PIXEL_FONT}`}
                    >
                        {takkoOrderCustomerLabel(customer)}
                    </p>
                    <p
                        className={`text-fg-primary text-xs whitespace-nowrap sm:text-sm ${PIXEL_FONT}`}
                    >
                        {line}
                    </p>
                    <div className="flex gap-1">
                        {order.map((id, index) => (
                            <div
                                key={index}
                                className="bg-grade-bronze/20 flex aspect-square w-[clamp(2rem,5.6vw,3.25rem)] items-center justify-center rounded-sm"
                            >
                                {showOrder ? (
                                    <motion.img
                                        key={`order-${customer}-${lives}-${index}`}
                                        src={TAKKO_ORDER_IMAGES[id]}
                                        alt=""
                                        draggable={false}
                                        initial={{ opacity: 0, scale: 0.6 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        // 보여 줄 때는 왼쪽부터 차례로 톡톡 나타난다
                                        transition={{
                                            duration: 0.18,
                                            delay: phase === 'showing' ? index * 0.12 : 0,
                                        }}
                                        className="size-[90%] [image-rendering:pixelated]"
                                    />
                                ) : (
                                    <span className={`text-grade-bronze text-base ${PIXEL_FONT}`}>
                                        ?
                                    </span>
                                )}
                            </div>
                        ))}
                    </div>
                    {/* 꼬리 — 테두리색 삼각형 위에 바탕색 삼각형을 겹쳐 도트 테두리처럼 (GameSpeechBubble과 같은 방식) */}
                    <span className="bg-fg-primary absolute top-full left-1/2 size-3 -translate-x-1/2 [clip-path:polygon(0_0,100%_0,50%_100%)]" />
                    <span className="bg-grade-bronze-soft absolute top-full left-1/2 -mt-[3px] size-2 -translate-x-1/2 [clip-path:polygon(0_0,100%_0,50%_100%)]" />
                </div>
            )}

            {/* 접시(image 239) — 카운터 위 가운데. 내준 타코야끼가 왼쪽부터 차례로 놓이고, 다 담으면 가운데로 모인다 */}
            <div className="absolute bottom-[22%] left-1/2 w-[40%] -translate-x-1/2">
                <img
                    src={TAKKO_ORDER_SCENE.plate}
                    alt=""
                    aria-hidden
                    draggable={false}
                    className="relative w-full [image-rendering:pixelated]"
                />
                <div
                    className={`absolute inset-x-[6%] bottom-[30%] flex ${picked.length === order.length ? 'justify-center' : 'justify-start'}`}
                >
                    {picked.map((id, index) => (
                        <motion.div
                            key={`plate-${customer}-${lives}-${index}`}
                            layout
                            initial={{ y: -16, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            transition={{ type: 'spring', stiffness: 500, damping: 26 }}
                            // 주문이 짧으면 크게, 길어도 접시 안에 다 들어가게 (최대 8개)
                            style={{ width: `${Math.min(17, 100 / order.length)}%` }}
                            className="relative aspect-square"
                        >
                            <img
                                src={TAKKO_ORDER_IMAGES[id]}
                                alt=""
                                aria-hidden
                                draggable={false}
                                className="size-full [image-rendering:pixelated]"
                            />
                            {/* 갓 담은 타코야끼에서 김이 한 번 모락 피어오르다 사라진다 */}
                            <motion.img
                                src={TAKKO_ORDER_STEAM[index % TAKKO_ORDER_STEAM.length]}
                                alt=""
                                aria-hidden
                                draggable={false}
                                initial={{ opacity: 0, y: 0, scale: 0.8 }}
                                animate={{ opacity: [0, 0.9, 0], y: -18, scale: 1.05 }}
                                transition={{ duration: 1.2, ease: 'easeOut' }}
                                className="pointer-events-none absolute bottom-[70%] left-1/2 w-[70%] -translate-x-1/2 [image-rendering:pixelated]"
                            />
                        </motion.div>
                    ))}
                </div>
            </div>

            {/* 위 — 나가기·소리 · 목숨 · 점수판 */}
            <div
                className={`absolute inset-x-0 top-0 flex items-start justify-between gap-3 p-3 ${phase === 'over' ? '' : 'z-10'}`}
            >
                <div className="flex items-start gap-2 sm:gap-3">
                    <GameImageButton kind="exit" size="small" onClick={onExit} />
                    <VolumeControl level={bgm.level} onLevelChange={bgm.setLevel} />
                    {(phase === 'showing' ||
                        phase === 'input' ||
                        phase === 'countdown' ||
                        phase === 'reveal' ||
                        phase === 'paused') && (
                        <GameImageButton
                            kind="pause"
                            size="small"
                            onClick={phase === 'paused' ? resume : pause}
                        />
                    )}
                </div>
                <GameLives lives={lives} max={TAKKO_ORDER_LIVES} />
                <ScoreBoard value={padScore(score)} />
            </div>

            {/* 아래 — 메뉴 버튼 4개. 그림과 키보드 번호만 두고 이름은 화면 낭독기로 읽는다 (도트 그림체) */}
            <div className="absolute inset-x-0 bottom-[3%] flex justify-center gap-[2.5%] px-4">
                {TAKKO_ORDER_MENU.map((item, index) => (
                    <button
                        key={item.id}
                        type="button"
                        disabled={phase !== 'input'}
                        onClick={() => pick(item.id)}
                        // 마우스로 눌러도 초점이 남지 않게 — 남으면 다음 키 입력이 이 버튼을 누른다
                        onMouseDown={(event) => event.preventDefault()}
                        aria-label={`${index + 1}번 ${item.name} 내주기`}
                        className="border-fg-primary bg-ticket-accent focus-visible:ring-border-focus relative flex aspect-square w-[clamp(2.75rem,8.5vw,4.75rem)] cursor-pointer items-center justify-center rounded-md border-[3px] shadow-[3px_3px_0_0_var(--color-fg-primary)] transition-transform focus-visible:ring-2 focus-visible:outline-none enabled:hover:-translate-y-0.5 enabled:active:translate-x-0.75 enabled:active:translate-y-0.75 enabled:active:shadow-none disabled:cursor-default"
                    >
                        {/* 틀리면 메뉴가 잠깐 어지러운 타코야끼(image 235)로 바뀐다 */}
                        <motion.img
                            key={phase === 'reveal' && !ok ? `dizzy-${lives}` : item.id}
                            src={
                                phase === 'reveal' && !ok
                                    ? TAKKO_ORDER_WRONG_IMAGE
                                    : TAKKO_ORDER_IMAGES[item.id]
                            }
                            alt=""
                            draggable={false}
                            initial={
                                phase === 'reveal' && !ok ? { rotate: -20, scale: 0.7 } : false
                            }
                            animate={{ rotate: 0, scale: 1 }}
                            transition={{ type: 'spring', stiffness: 420, damping: 14 }}
                            className="size-[82%] [image-rendering:pixelated]"
                        />
                        <span
                            aria-hidden
                            className={`border-fg-primary bg-surface-page text-fg-primary absolute -top-2 -left-2 flex size-5 items-center justify-center rounded-sm border-2 text-[0.625rem] sm:size-6 sm:text-xs ${PIXEL_FONT}`}
                        >
                            {index + 1}
                        </span>
                    </button>
                ))}
            </div>

            {/* 맞힘·틀림 — 게임 판 테두리를 초록·빨강으로 잠깐 바꾼다 */}
            {phase === 'reveal' && (
                <div
                    aria-hidden
                    className={`pointer-events-none absolute inset-0 rounded-2xl border-4 ${ok ? 'border-semantic-success' : 'border-semantic-error'}`}
                />
            )}

            {phase === 'ready' && (
                <GameStartHint onStart={start}>
                    <GameStartHintLine>
                        <span className="flex items-center gap-1.5 [@media(hover:none)]:hidden">
                            주문을 외웠다가 클릭 또는 <GameKey>1</GameKey>~<GameKey>4</GameKey>로
                            내주기
                        </span>
                        <span className="hidden [@media(hover:none)]:inline">
                            주문을 외웠다가 버튼을 순서대로 누르기
                        </span>
                    </GameStartHintLine>
                    <GameStartHintLine>목숨 3개 · 맞힐수록 주문이 길어져요</GameStartHintLine>
                </GameStartHint>
            )}

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

            {/* 스크린리더 — 주문과 결과를 알린다 */}
            <p aria-live="polite" className="sr-only">
                {phase === 'showing' ? `주문: ${order.map(nameOf).join(', ')}` : ''}
                {phase === 'input' ? `${picked.length + 1}번째를 골라 주세요` : ''}
                {phase === 'reveal'
                    ? ok
                        ? '맞았어요'
                        : `틀렸어요. 주문은 ${order.map(nameOf).join(', ')}`
                    : ''}
                {phase === 'over' ? `게임 끝. ${score}점` : ''}
            </p>
        </div>
    );
}
