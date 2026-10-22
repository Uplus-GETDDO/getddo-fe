import { motion } from 'framer-motion';

import { PIXEL_FONT } from '../model/pixelFont';

/** 시작·이어 하기 전 3, 2, 1 — 숫자가 바뀔 때마다 톡 튀어나온다 (타꼬런·글자색깔 맞추기 공용) */
export function GameCountdown({ value }: { value: number }) {
    return (
        <motion.p
            key={value}
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: 'spring', stiffness: 420, damping: 18 }}
            className={`text-ticket-accent text-[clamp(2rem,6.7cqw,4rem)] leading-none drop-shadow-md ${PIXEL_FONT}`}
        >
            {value}
        </motion.p>
    );
}
