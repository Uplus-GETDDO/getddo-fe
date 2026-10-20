import { motion } from 'framer-motion';

import { useCountUp } from '@shared/hooks/useCountUp';
import { formatNumber } from '@shared/utils/format';

/** 게임 보상은 게임별 하루 1회 응모권 1장 (getddo-spec 게임 규칙) */
const DAILY_GAME_REWARD = 1;

/** 대표 영역이 나타난 뒤 차례로 올라오도록 첫 카드 지연과 카드 사이 간격 */
const FIRST_DELAY_S = 0.3;
const STAGGER_S = 0.08;

function StatCard({
    label,
    order,
    children,
}: {
    label: string;
    order: number;
    children: React.ReactNode;
}) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
                duration: 0.45,
                delay: FIRST_DELAY_S + order * STAGGER_S,
                ease: [0.22, 1, 0.36, 1],
            }}
            className="bg-action-neutral flex min-w-0 flex-1 flex-col gap-2 rounded-2xl p-4"
        >
            <span className="text-caption text-border-strong">{label}</span>
            <span className="text-body-sm-bold text-fg-on-brand leading-4">{children}</span>
        </motion.div>
    );
}

/** 최고점 · 오늘 플레이 · 오늘 받은 응모권 — 화면에 들어올 때 차례로 올라온다 */
export function GameStats({
    bestScore,
    todayPlayCount,
    rewardedToday,
}: {
    bestScore?: number;
    todayPlayCount?: number;
    rewardedToday?: boolean;
}) {
    const bestScoreDisplay = useCountUp(bestScore, { fromZero: true, durationMs: 900 });

    return (
        // 세 카드를 합친 폭이 위 게임 영역과 같도록 바깥 상자 여백 없이 늘어놓는다
        <div className="flex w-full flex-col gap-4 sm:flex-row">
            <StatCard label="최고점" order={0}>
                {bestScoreDisplay == null ? '-' : `${formatNumber(bestScoreDisplay)}점`}
            </StatCard>
            <StatCard label="오늘 플레이" order={1}>
                {`${formatNumber(todayPlayCount ?? 0)}회`}
            </StatCard>
            <StatCard label="오늘 받은 응모권" order={2}>
                {rewardedToday ? DAILY_GAME_REWARD : 0}{' '}
                <span className="text-border-strong">/ {DAILY_GAME_REWARD}장</span>
            </StatCard>
        </div>
    );
}
