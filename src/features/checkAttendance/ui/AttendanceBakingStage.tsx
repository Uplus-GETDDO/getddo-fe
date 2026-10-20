import { motion } from 'framer-motion';
import { useEffect, useRef } from 'react';

import shopCounter from '@shared/assets/shop/shop-counter.jpg';
import shopWall from '@shared/assets/shop/shop-wall.jpg';
import { cn } from '@shared/utils/cn';

import bakingSprite from '../assets/baking-sprite.webp';
import bakingSteam from '../assets/baking-steam.webp';

/** 스프라이트(피그마 image 233) — 가로로 이어진 10프레임, 한 프레임 255×270 (철판 위치를 맞춰 잘랐다) */
const FRAME_COUNT = 10;

const BAKING_LABEL = '타코야끼 굽는 중…';

/** 김 덩이 — 철판 왼쪽·가운데·오른쪽에서 엇갈려 올라온다 */
const STEAM_PUFFS = [
    { left: '22%', delay: 0 },
    { left: '50%', delay: 0.6 },
    { left: '78%', delay: 1.2 },
] as const;

export { bakingSprite as BAKING_SPRITE_SRC };

/**
 * 출석 굽기 연출 — 타코야끼를 굽는 10프레임 스프라이트를 한 번 재생하고 마지막 프레임에서 멈춘다.
 * 프레임을 뚝뚝 넘기도록 steps() 타이밍을 쓰고, Web Animations API로 재생해 공용 CSS 키프레임이 필요 없다.
 * 철판 위로 김(피그마 image 187)이 피어오르고, 아래에는 무엇을 굽는지와 진행 막대를 둬 기다림이 비어 보이지 않게 한다.
 * 동작 줄이기 설정이면 완성된 마지막 장면만 보여준다
 */
export function AttendanceBakingStage({
    durationMs,
    rewardTicketCount,
    className,
}: {
    durationMs: number;
    /** 다 구우면 받는 응모권 장수 — 출석 보상은 브론즈 고정 (getddo-spec ticket.md) */
    rewardTicketCount?: number;
    className?: string;
}) {
    const spriteRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const el = spriteRef.current;
        if (!el) return;
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
            el.style.backgroundPosition = '100% 0';
            return;
        }
        // background-size가 10배라 0%→100%가 첫 프레임→마지막 프레임, 10단계로 끊어 넘긴다
        const animation = el.animate(
            [{ backgroundPosition: '0% 0' }, { backgroundPosition: '100% 0' }],
            { duration: durationMs, easing: `steps(${FRAME_COUNT}, jump-none)`, fill: 'forwards' },
        );
        return () => animation.cancel();
    }, [durationMs]);

    return (
        <div
            role="status"
            aria-label={BAKING_LABEL}
            // 작은 타코야끼 가게 — 미션 배너와 같은 벽 그림 위에서 굽고, 아래에 나무 카운터 띠를 깐다 (그림이라 다크에서도 라이트 색)
            className={cn(
                'force-light relative flex flex-col items-center justify-between gap-2 overflow-hidden rounded-xl bg-cover bg-top px-4 pt-4',
                className,
            )}
            style={{ backgroundImage: `url(${shopWall})` }}
        >
            {/* 벽 그림이 어두운 웜톤이라 배너처럼 흰 막을 얇게 덮어 글자가 잘 읽히게 한다 */}
            <div aria-hidden className="bg-surface-page/55 absolute inset-0" />
            {/* 나무 카운터 띠 — 철판이 이 위에 놓인다 */}
            <div
                aria-hidden
                className="absolute inset-x-0 bottom-0 h-14 bg-size-[auto_100%] bg-left bg-repeat-x"
                style={{ backgroundImage: `url(${shopCounter})` }}
            />
            <div className="relative flex flex-col items-center gap-2">
                {/* 글자가 앞에서부터 한 글자씩 통통 튀어 오른다 (동작 줄이기 설정이면 멈춰 있다) */}
                <span aria-hidden className="text-subhead text-fg-primary flex">
                    {[...BAKING_LABEL].map((char, index) => (
                        <motion.span
                            key={index}
                            className="inline-block whitespace-pre"
                            animate={{ y: [0, -6, 0] }}
                            transition={{
                                duration: 0.5,
                                delay: index * 0.06,
                                repeat: Infinity,
                                repeatDelay: 0.3,
                                ease: 'easeOut',
                            }}
                        >
                            {char}
                        </motion.span>
                    ))}
                </span>
                {rewardTicketCount != null && (
                    <span className="text-body-sm text-fg-secondary">
                        다 구우면 브론즈 응모권 {rewardTicketCount}장을 받아요
                    </span>
                )}
                {/* 굽기 시간만큼 차오르는 막대 — 곧 끝난다는 걸 보여준다 */}
                <div
                    aria-hidden
                    className="bg-surface-page h-1.5 w-40 overflow-hidden rounded-full"
                >
                    <motion.div
                        className="bg-fg-primary h-full rounded-full"
                        initial={{ width: '0%' }}
                        animate={{ width: '100%' }}
                        transition={{ duration: durationMs / 1000, ease: 'linear' }}
                    />
                </div>
            </div>
            {/* 철판 아래쪽이 카운터 띠에 걸치도록 띄워 둔다 */}
            <div className="relative mb-4">
                {/* 김이 모락모락 — 세 덩이가 엇갈려 올라가며 커지고 흐려진다. 늘 한두 덩이는 보이도록 시작을 나눈다 */}
                {STEAM_PUFFS.map((puff) => (
                    <motion.img
                        key={puff.left}
                        src={bakingSteam}
                        alt=""
                        aria-hidden
                        // 크림색 김이 벽 그림에 묻히지 않게 살짝 밝히고 옅은 그림자로 윤곽을 준다
                        className="pointer-events-none absolute bottom-[55%] w-24 -translate-x-1/2 brightness-110 drop-shadow-[0_0_3px_rgb(from_var(--color-ink)_r_g_b_/_0.25)]"
                        style={{ left: puff.left }}
                        initial={{ opacity: 0, y: 10, scale: 0.8 }}
                        animate={{
                            opacity: [0, 1, 0.9, 0],
                            y: [10, -6, -20, -34],
                            scale: [0.8, 1, 1.1, 1.2],
                        }}
                        transition={{
                            duration: 1.8,
                            delay: puff.delay,
                            repeat: Infinity,
                            ease: 'easeOut',
                        }}
                    />
                ))}
                <div
                    ref={spriteRef}
                    aria-hidden
                    className="relative aspect-[255/270] w-32 bg-no-repeat"
                    style={{
                        backgroundImage: `url(${bakingSprite})`,
                        backgroundSize: `${FRAME_COUNT * 100}% 100%`,
                        backgroundPosition: '0% 0',
                    }}
                />
            </div>
        </div>
    );
}
