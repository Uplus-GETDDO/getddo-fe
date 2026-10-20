import type { MouseEvent } from 'react';

import { motion, useAnimate, useInView, useReducedMotion } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';

import type { Prize } from '@entities/drawResult';

import { useSessionStore } from '@entities/user';
import { Button } from '@shared/ui/button';
import { maskName } from '@shared/utils/format';

import type { Burst } from './ConfettiBurst';

import winBg from '../assets/win-bg.webp';
import winDecoRight from '../assets/win-deco-right.webp';
import winMascot from '../assets/win-mascot.webp';
import { ConfettiBurst } from './ConfettiBurst';

/** 종이 조각이 다 떨어질 때까지 — 이 뒤에 터진 자리를 지운다 */
const BURST_LIFETIME_MS = 4000;
/** 마우스를 올릴 때마다 다시 움직이되, 앞 움직임이 끝나기 전에는 겹치지 않게 쉰다 */
const REPLAY_COOLDOWN_MS = 1800;

/** 글 세 줄이 차례로 천천히 떠오른다 — 마스코트가 올라온 뒤 */
const textIn = (order: number) => ({
    initial: { opacity: 0, y: 12 },
    transition: { duration: 0.6, delay: 0.4 + order * 0.12, ease: 'easeOut' as const },
});

/**
 * 당첨 배너.
 *
 * 당첨 여부는 본인 결과 조회(E09)가 판정한 값만 쓴다. 공개 명단에서 뒷자리가 맞았다는 것은
 * 같은 뒷자리를 가진 다른 사람일 수 있어 '내가 당첨됐다'의 근거가 되지 못한다.
 *
 * 그림은 세 겹이다 — 햇살 배경(피그마 image 219), 오른쪽 응모권·별 장식(image 213 오른쪽 조각),
 * 트로피 든 마스코트(image 217). 왼쪽 장식은 마스코트와 겹쳐 지저분해 보여 뺐다.
 *
 * 연출은 '느릿하고 쫄깃하게' — 팝업처럼 툭 튀지 않도록 낮은 탄성의 스프링과 긴 시간을 쓴다.
 * 화면에 들어올 때 한 번: 배너가 떠오르고, 마스코트가 아래에서 천천히 올라와 살짝 출렁이며 멈추고,
 * 마스코트 자리에서 종이 조각이 하늘하늘 떨어지고, 글이 차례로 올라온다. 그 뒤 마스코트는 둥실거린다.
 * 마우스를 올리면 마스코트와 장식이 제자리에서 천천히 한 번 들썩인다(처음부터 다시 그리지 않는다).
 * 누르면 누른 자리에서 종이 조각이 아래로 떨어진다.
 * 동작 줄이기 설정이면 다시 재생·종이 조각을 모두 끈다.
 */
export function WinnerBanner({ prize }: { prize: Prize | null }) {
    const userName = useSessionStore((state) => state.user?.name);
    const reduceMotion = useReducedMotion();
    const [scope, animate] = useAnimate<HTMLElement>();
    const mascotRef = useRef<HTMLDivElement>(null);
    const inView = useInView(scope, { once: true, amount: 0.4 });

    const [bursts, setBursts] = useState<Burst[]>([]);
    const lastPlayAt = useRef(0);
    const burstId = useRef(0);

    const burstAt = (x: number, y: number) => {
        if (reduceMotion) return;
        const id = ++burstId.current;
        setBursts((prev) => [...prev, { id, x, y }]);
        setTimeout(
            () => setBursts((prev) => prev.filter((burst) => burst.id !== id)),
            BURST_LIFETIME_MS,
        );
    };

    // 처음 화면에 들어올 때 마스코트가 튀어 오르는 순간에 맞춰 마스코트 자리에서 한 번 터뜨린다
    useEffect(() => {
        if (!inView || reduceMotion) return;
        const timer = setTimeout(() => {
            const section = scope.current?.getBoundingClientRect();
            const mascot = mascotRef.current?.getBoundingClientRect();
            if (!section || !mascot) return;
            const id = ++burstId.current;
            setBursts((prev) => [
                ...prev,
                {
                    id,
                    x: mascot.left - section.left + mascot.width / 2,
                    y: mascot.top - section.top + mascot.height / 3,
                },
            ]);
            setTimeout(
                () => setBursts((prev) => prev.filter((burst) => burst.id !== id)),
                BURST_LIFETIME_MS,
            );
        }, 600);
        return () => clearTimeout(timer);
    }, [inView, reduceMotion, scope]);

    const replay = () => {
        if (reduceMotion) return;
        const now = Date.now();
        if (now - lastPlayAt.current < REPLAY_COOLDOWN_MS) return;
        lastPlayAt.current = now;
        // 처음 등장 연출과 겹치지 않게 다른 층(data-hover)을 움직인다
        void animate(
            '[data-hover="mascot"]',
            { y: [0, -14, 0], rotate: [0, -5, 3, 0] },
            { duration: 1.6, ease: 'easeInOut' },
        );
        void animate(
            '[data-hover="deco"]',
            { x: [0, -12, 0], y: [0, -6, 0] },
            { duration: 1.8, ease: 'easeInOut' },
        );
    };

    const onClick = (event: MouseEvent<HTMLElement>) => {
        const rect = event.currentTarget.getBoundingClientRect();
        burstAt(event.clientX - rect.left, event.clientY - rect.top);
    };

    return (
        <motion.section
            ref={scope}
            initial={{ opacity: 0, y: 24 }}
            animate={inView ? { opacity: 1, y: 0 } : undefined}
            transition={{ type: 'spring', stiffness: 120, damping: 20 }}
            onMouseEnter={replay}
            onClick={onClick}
            className="force-light bg-ticket-accent relative overflow-hidden rounded-2xl"
        >
            <img
                src={winBg}
                alt=""
                className="pointer-events-none absolute inset-0 size-full object-cover"
            />
            {/* 오른쪽 장식 — 바깥에서 안쪽으로 천천히 밀려 들어온다 */}
            <div data-hover="deco" className="pointer-events-none absolute inset-y-0 right-0">
                <motion.img
                    src={winDecoRight}
                    alt=""
                    initial={{ opacity: 0, x: 40, rotate: 4 }}
                    animate={inView ? { opacity: 1, x: 0, rotate: 0 } : undefined}
                    transition={{ type: 'spring', stiffness: 90, damping: 14, delay: 0.25 }}
                    className="h-full w-auto"
                />
            </div>
            <ConfettiBurst bursts={bursts} />

            <div className="relative flex flex-col gap-6 p-6 lg:flex-row lg:items-center lg:px-10">
                {/* 축하 연출용 장식이라 읽어 줄 내용이 없다 — 등수·경품은 옆 글에서 그대로 읽힌다 */}
                <motion.div
                    ref={mascotRef}
                    // 튀어 오른 뒤에는 제자리에서 살짝 둥실거린다
                    animate={inView && !reduceMotion ? { y: [0, -5, 0] } : undefined}
                    transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut', delay: 1.6 }}
                    className="shrink-0 self-center"
                >
                    <div data-hover="mascot">
                        <motion.img
                            src={winMascot}
                            alt=""
                            initial={{ opacity: 0, y: 60, scale: 0.7, rotate: -10 }}
                            animate={inView ? { opacity: 1, y: 0, scale: 1, rotate: 0 } : undefined}
                            // 낮은 탄성 + 무거운 질량 — 천천히 올라와 두어 번 출렁이며 멈춘다
                            transition={{
                                type: 'spring',
                                stiffness: 140,
                                damping: 11,
                                mass: 1.2,
                                opacity: { duration: 0.4 },
                            }}
                            className="h-40 w-auto object-contain"
                        />
                    </div>
                </motion.div>

                <div className="flex min-w-0 flex-1 flex-col gap-2">
                    {prize && (
                        <motion.span
                            {...textIn(0)}
                            animate={inView ? { opacity: 1, y: 0 } : undefined}
                            className="bg-action-neutral text-fg-on-brand text-caption w-fit rounded-full px-2.5 py-1"
                        >
                            {prize.rank}등 당첨
                        </motion.span>
                    )}
                    {/* 남이 볼 수 있는 화면이라 이름 가운데를 가린다 */}
                    <motion.h3
                        {...textIn(1)}
                        animate={inView ? { opacity: 1, y: 0 } : undefined}
                        className="text-title-1 text-fg-primary"
                    >
                        축하해요{userName ? `, ${maskName(userName)}님` : ''}!
                    </motion.h3>
                    <motion.p
                        {...textIn(2)}
                        animate={inView ? { opacity: 1, y: 0 } : undefined}
                        className="text-body text-fg-secondary"
                    >
                        {prize ? `${prize.name}에 당첨됐어요. ` : ''}
                        경품 수령 안내는 가입하신 연락처로 따로 보내 드려요.
                    </motion.p>
                </div>

                {/*
                 * TODO: 배송 정보 입력은 API 계약이 없다 (getddo-spec 05-api에 수령 정보 엔드포인트 없음).
                 * 시안의 '입력 마감 D-7' 칩도 기한을 내려 주는 필드가 없어 임의로 적지 않고 비워 둔다.
                 */}
                <Button size="lg" disabled className="shrink-0 lg:w-55">
                    배송 정보 입력하기
                </Button>
            </div>
        </motion.section>
    );
}
