import { motion, useReducedMotion } from 'framer-motion';
import { useEffect, useState } from 'react';

import mascotDizzy from '@shared/assets/ui/mascot-dizzy.png';

import type { GachaPhase } from './CapsuleGacha';

import { CapsuleGacha } from './CapsuleGacha';

/** 화면이 뜨고 기계를 돌리기 전까지 — 기계와 공이 먼저 눈에 들어오게 한 숨 쉰다 */
const AUTO_SPIN_DELAY_MS = 900;

/**
 * 상태 화면 그림 — 응모권 뽑기 기계를 저절로 돌려 '꽝'을 뽑는다. 누르지 않아도 끝까지 진행된다.
 * notFound: '4 [기계] 4' — 기계가 흔들리고 손잡이가 돌아 캡슐이 나오고, 열린 캡슐이 가운데 0 자리가 된다.
 * error: 숫자 없이 같은 뽑기만.
 * 캡슐에서는 응모권 대신 어지러운 타코야끼(꽝)가 나온다. 동작 줄이기 설정이면 처음부터 열린 캡슐만 그린다.
 * 그림은 꾸밈이라 화면 낭독기에는 읽히지 않는다 — 뜻은 아래 제목·설명이 전한다
 */
export function CapsuleStatusArt({ variant }: { variant: 'notFound' | 'error' }) {
    const reduceMotion = useReducedMotion() ?? false;
    const [phase, setPhase] = useState<GachaPhase>(reduceMotion ? 'revealed' : 'idle');

    useEffect(() => {
        if (phase !== 'idle') return;
        const timer = setTimeout(() => setPhase('spinning'), AUTO_SPIN_DELAY_MS);
        return () => clearTimeout(timer);
    }, [phase]);

    const gacha = (
        <CapsuleGacha
            phase={phase}
            onPhaseChange={setPhase}
            rewardSrc={mascotDizzy}
            reduceMotion={reduceMotion}
        />
    );

    if (variant === 'error') {
        return <div aria-hidden>{gacha}</div>;
    }

    // 캡슐이 열리면 숫자 4가 양쪽에서 붙어 404가 완성된다 — 무대 폭(248)이 열린 캡슐보다 넓어 음수 여백으로 당긴다
    const digit = (delay: number) => (
        <motion.span
            initial={reduceMotion ? false : { opacity: 0, y: 16 }}
            animate={phase === 'revealed' ? { opacity: 1, y: 0 } : { opacity: 0.12, y: 0 }}
            transition={{
                duration: 0.45,
                ease: 'easeOut',
                delay: phase === 'revealed' ? delay : 0,
            }}
        >
            4
        </motion.span>
    );

    return (
        <div
            aria-hidden
            className="text-fg-primary flex items-center justify-center text-[4.5rem] leading-none font-black tracking-tight select-none sm:text-[8.5rem]"
        >
            {digit(0.1)}
            <div className="-mx-10 sm:-mx-8">{gacha}</div>
            {digit(0.2)}
        </div>
    );
}
