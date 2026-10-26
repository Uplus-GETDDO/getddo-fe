import { useAnimate } from 'framer-motion';
import { useEffect, useEffectEvent, useRef, useState } from 'react';

import type { TicketGrade } from '@entities/ticket';

import type { TakkoOrderItemId } from '../model/takkoOrder';
import type { GameOverHandler, GameSessionProps } from '../model/types';

import { createXorshift32, ActiveClock } from '../model/gameSession';
import {
    TAKKO_ORDER_MENU,
    createTakkoOrder,
    judgeTakkoOrder,
    takkoOrderPoints,
    takkoOrderShowMs,
} from '../model/takkoOrder';
import {
    TAKKO_ORDER_BGM,
    TAKKO_ORDER_CUSTOMERS,
    TAKKO_ORDER_SOUNDS,
} from '../model/takkoOrderAssets';
import { isInteractive } from '../utils/isInteractive';
import { useLoopingBgm } from './useLoopingBgm';

/** ready 시작 안내 · countdown 3,2,1 · showing 주문 보여 주기 · input 내주기 · reveal 맞음/틀림 · over 끝 */
export type TakkoOrderPhase =
    'ready' | 'countdown' | 'showing' | 'input' | 'reveal' | 'over' | 'paused';

const COUNTDOWN_FROM = 3;
const COUNTDOWN_STEP_MS = 700;
/** 결과를 보여 주는 시간 — 틀리면 정답 주문을 읽을 수 있게 더 길게 */
const REVEAL_CORRECT_MS = 900;
const REVEAL_WRONG_MS = 1600;

export type TakkoOrderGameProps = GameSessionProps & {
    bestScore?: number;
    onExit: () => void;
    onGameOver?: GameOverHandler;
};

/**
 * 타꼬 주문 게임의 상태기·타이머·키 입력·판정 로직 — 화면은 TakkoOrderGame 컴포넌트가 그린다.
 * 틀려도 주문 개수만큼 끝까지 내준 뒤에 판정한다 — 중간에 바로 끊기면 무엇을 틀렸는지 알기 어렵다.
 * 맞히면 주문이 하나씩 길어지고, 틀리면 목숨이 하나 줄고 같은 길이의 새 주문을 받는다. 목숨 3개를 다 쓰면 끝.
 * 결과 표시 중에도 멈춰 탭 밖에서 다음 주문의 노출 시간이 소비되지 않게 한다
 */
export function useTakkoOrderGame({
    session,
    onRestart,
    onRecordingError,
    bestScore = 0,
    onGameOver,
}: TakkoOrderGameProps) {
    const [random] = useState(() => createXorshift32(session.gameData.seed));
    const [phase, setPhase] = useState<TakkoOrderPhase>('ready');
    const [countdown, setCountdown] = useState(COUNTDOWN_FROM);
    const [length, setLength] = useState(session.rules.startLength!);
    const [order, setOrder] = useState<TakkoOrderItemId[]>(() => []);
    const [picked, setPicked] = useState<TakkoOrderItemId[]>([]);
    const [ok, setOk] = useState(false);
    // 주문을 보여 주는 남은 시간 — 어느 주문의 값인지 함께 둬, 새 주문으로 바뀐 첫 화면에 앞 주문의 값이 보이지 않게 한다
    const [showLeft, setShowLeft] = useState<{ order: TakkoOrderItemId[]; ms: number } | null>(
        null,
    );
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
    const pausedPhase = useRef<TakkoOrderPhase>('showing');
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

    // 메뉴 하나를 내준다 — 주문 개수만큼 다 내면 판정한다. 기록은 서버 규칙대로 맞히면 주문 전체, 틀리면 처음 틀린 메뉴까지
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
        if (next.length < order.length) return;
        revealedRef.current = true;
        setPhase('reveal');
        const { ok: correct, record } = judgeTakkoOrder(order, next);
        roundsRef.current.push({ sequence: roundsRef.current.length + 1, picks: record });
        setOk(correct);
        if (correct) {
            setScore((n) => n + takkoOrderPoints(order.length));
            playSound('correct');
            return;
        }
        setLives((n) => n - 1);
        playSound('wrong');
        // 틀리면 주문서가 좌우로 짧게 흔들린다 (동작 줄이기 설정이면 흔들리지 않는다)
        if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
            void animateBoard(boardScope.current, { x: [0, -8, 7, -5, 3, 0] }, { duration: 0.35 });
        }
    };

    // 판정 전에 마지막으로 낸 메뉴 하나를 되돌린다 — 서버에는 지운 뒤의 최종 순서만 간다
    const undo = () => {
        if (phase !== 'input' || revealedRef.current || pickedRef.current.length === 0) return;
        const next = pickedRef.current.slice(0, -1);
        pickedRef.current = next;
        setPicked(next);
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

    // 주문을 보여 준 뒤 가리고 내주기로. 보여 주는 동안 남은 시간을 매 화면마다 다시 읽어 막대·초로 보여 준다
    useEffect(() => {
        if (phase !== 'showing') return;
        showClock.resume(performance.now());
        const total = takkoOrderShowMs(order.length);
        const timer = setTimeout(
            () => setPhase('input'),
            Math.max(0, total - showClock.read(performance.now())),
        );
        let frame = requestAnimationFrame(function tick() {
            setShowLeft({ order, ms: Math.max(0, total - showClock.read(performance.now())) });
            frame = requestAnimationFrame(tick);
        });
        return () => {
            clearTimeout(timer);
            cancelAnimationFrame(frame);
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
            if (event.key === 'Backspace') {
                event.preventDefault();
                undo();
                return;
            }
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
    const showTotal = takkoOrderShowMs(order.length);
    const showMs = showLeft?.order === order ? showLeft.ms : showTotal;
    // 주문 칸 크기 — 짧은 주문은 크게, 길어지면 말풍선이 판 왼쪽 밖으로 나가지 않게 줄인다 (판 너비 34% 안에 다 들어가게)
    const slotSize = `min(5.4cqw, ${34 / order.length}cqw)`;
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

    return {
        phase,
        countdown,
        order,
        picked,
        ok,
        lives,
        score,
        best,
        newBest,
        customer,
        customerSrc,
        line,
        slotSize,
        playing,
        showOrder,
        showMs,
        showTotal,
        rewardOpen,
        setRewardOpen,
        ticketsGranted,
        rewardGrade,
        boardScope,
        restartRef,
        bgm,
        start,
        pick,
        undo,
        pause,
        resume,
    };
}
