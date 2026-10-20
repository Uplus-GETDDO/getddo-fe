import { useReducedMotion } from 'framer-motion';
import { useEffect, useState } from 'react';

import { cn } from '@shared/utils/cn';

import frame1 from '../assets/banner-mascot-1.webp';
import frame2 from '../assets/banner-mascot-2.webp';
import frame3 from '../assets/banner-mascot-3.webp';
import frame4 from '../assets/banner-mascot-4.webp';
import frame5 from '../assets/banner-mascot-5.webp';

/** 타꼬 저글링 프레임 (피그마 image 265~269) — 첫 장이 쉬는 자세다 */
const FRAMES = [frame1, frame2, frame3, frame4, frame5];
const FRAME_MS = 110;
/** 배너가 넘어올 때마다 저글링을 두 바퀴 돌리고 첫 장에서 멈춘다 */
const LOOPS = 2;

/**
 * 배너 캐릭터 — 보이는 배너가 되면 프레임을 넘겨 제자리에서 저글링한다.
 * 배너는 옆으로 미끄러지며 넘어가므로 캐릭터는 따로 날아다니지 않고 그 자리에서만 움직인다.
 * 다섯 장을 겹쳐 두고 보이는 장만 바꿔, 넘길 때 그림을 새로 받느라 깜빡이지 않게 한다
 */
export function BannerMascot({ active, className }: { active: boolean; className?: string }) {
    const reduceMotion = useReducedMotion();
    const [frame, setFrame] = useState(0);

    useEffect(() => {
        if (!active || reduceMotion) return;
        let step = 0;
        const timer = setInterval(() => {
            step += 1;
            setFrame(step % FRAMES.length);
            if (step >= FRAMES.length * LOOPS) clearInterval(timer);
        }, FRAME_MS);
        return () => {
            clearInterval(timer);
            setFrame(0);
        };
    }, [active, reduceMotion]);

    return (
        <div aria-hidden className={cn('pointer-events-none select-none', className)}>
            {FRAMES.map((src, index) => (
                <img
                    key={src}
                    src={src}
                    alt=""
                    className={cn(
                        'w-full',
                        index > 0 && 'absolute inset-0',
                        // 보이지 않는 장도 자리에 두어 미리 받아 둔다
                        index !== frame && 'invisible',
                    )}
                />
            ))}
        </div>
    );
}
