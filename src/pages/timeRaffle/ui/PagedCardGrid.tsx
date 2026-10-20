import type { ReactNode } from 'react';

import { motion, useReducedMotion } from 'framer-motion';

/**
 * 두 칸 카드 목록의 한 쪽 — 쪽을 넘기면 넘긴 방향에서 밀려 들어온다 (홈 배너·오픈 예정 넘김과 같은 느낌).
 * 마지막 줄에 카드가 하나만 남으면 그 카드가 두 칸을 다 쓴다 — 반쪽이 비어 보였다.
 * 처음 그릴 때와 동작 줄이기 설정을 켠 사용자에게는 움직이지 않는다
 */
export function PagedCardGrid<T>({
    items,
    pageKey,
    direction,
    animate,
    renderItem,
}: {
    items: readonly T[];
    /** 지금 쪽 — 바뀌면 새로 밀려 들어온다 */
    pageKey: number;
    direction: number;
    /** 사용자가 넘긴 뒤에만 움직인다 */
    animate: boolean;
    renderItem: (item: T, wide: boolean) => ReactNode;
}) {
    const reduceMotion = useReducedMotion();
    return (
        <motion.div
            key={pageKey}
            initial={animate && !reduceMotion ? { opacity: 0, x: direction * 32 } : false}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
            className="grid grid-cols-1 gap-4 lg:grid-cols-2"
        >
            {items.map((item, index) =>
                renderItem(item, index === items.length - 1 && items.length % 2 === 1),
            )}
        </motion.div>
    );
}
