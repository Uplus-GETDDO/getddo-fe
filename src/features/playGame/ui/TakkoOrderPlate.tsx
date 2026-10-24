import { motion } from 'framer-motion';

import type { TakkoOrderItemId } from '../model/takkoOrder';

import {
    TAKKO_ORDER_IMAGES,
    TAKKO_ORDER_SCENE,
    TAKKO_ORDER_STEAM,
} from '../model/takkoOrderAssets';

/**
 * 접시(image 239) — 카운터 위 가운데. 내준 타코야끼가 왼쪽부터 차례로 놓이고, 다 담으면 가운데로 모인다
 */
export function TakkoOrderPlate({
    customer,
    lives,
    orderLength,
    picked,
}: {
    customer: number;
    lives: number;
    orderLength: number;
    picked: TakkoOrderItemId[];
}) {
    return (
        <div className="absolute bottom-[22%] left-1/2 w-[40%] -translate-x-1/2">
            <img
                src={TAKKO_ORDER_SCENE.plate}
                alt=""
                aria-hidden
                draggable={false}
                className="relative w-full [image-rendering:pixelated]"
            />
            <div
                className={`absolute inset-x-[6%] bottom-[30%] flex ${picked.length === orderLength ? 'justify-center' : 'justify-start'}`}
            >
                {picked.map((id, index) => (
                    <motion.div
                        key={`plate-${customer}-${lives}-${index}`}
                        layout
                        initial={{ y: -16, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        transition={{ type: 'spring', stiffness: 500, damping: 26 }}
                        // 주문이 짧으면 크게, 길어도 접시 안에 다 들어가게 (최대 8개)
                        style={{ width: `${Math.min(17, 100 / orderLength)}%` }}
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
    );
}
