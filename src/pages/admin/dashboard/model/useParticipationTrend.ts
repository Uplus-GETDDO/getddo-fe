import type { GrantUserCount, TicketSourceType } from '@entities/ticket';

import { useAdminTicketGrantUserCounts } from '@entities/ticket';
import { useAdminUserCount } from '@entities/user';
import { recentKstDays } from '@shared/lib/date';
import { useVirtualClock } from '@shared/lib/virtualClock';

/** 참여율을 보는 활동 — 사용자 화면의 미션 탭에 함께 있는 출석·설문/퀴즈·게임. 응모권 지급 출처로 구분한다 */
export const PARTICIPATION_SOURCES = [
    { source: 'ATTENDANCE', label: '출석' },
    { source: 'MISSION', label: '설문·퀴즈' },
    { source: 'GAME', label: '게임' },
] as const satisfies readonly { source: TicketSourceType; label: string }[];

export type ParticipationSource = (typeof PARTICIPATION_SOURCES)[number]['source'];

/** 대시보드 그래프 기간 — 최근 7일 고정 */
export const TREND_DAYS = 7;

export interface ParticipationDay {
    ymd: string;
    /** 축 라벨 "10/16" */
    label: string;
    /** 활동별 참여율(%) — 아직 못 받았으면 null */
    rates: Record<ParticipationSource, number | null>;
    /** 활동별 참여한 사람 수 */
    users: Record<ParticipationSource, GrantUserCount | undefined>;
}

const axisLabel = (ymd: string) => {
    const [, month, day] = ymd.split('-');
    return `${Number(month)}/${Number(day)}`;
};

/**
 * 최근 days일(KST)의 날짜별 활동 참여율 = 그날 보상을 받은 사용자 ÷ 활성 일반 사용자.
 * 날짜별 사용자 수를 주는 집계 API가 없어 날짜×활동마다 지급 이력을 받아 센다. 분모는 지금의 활성 사용자 수다
 */
export function useParticipationTrend(days = TREND_DAYS) {
    const ranges = recentKstDays(useVirtualClock().now(), days);
    const activeUsers = useAdminUserCount({ role: 'USER', status: 'ACTIVE' });
    // 위 숫자 카드와 같은 조건(from·to·sourceType 순서)이라 오늘 값은 캐시를 나눠 쓴다
    const participants = useAdminTicketGrantUserCounts(
        ranges.flatMap(({ from, to }) =>
            PARTICIPATION_SOURCES.map(({ source }) => ({ from, to, sourceType: source })),
        ),
    );
    const total = activeUsers.data;

    const rows: ParticipationDay[] = ranges.map(({ ymd }, dayIndex) => {
        const countOf = (source: ParticipationSource) =>
            participants.counts[
                dayIndex * PARTICIPATION_SOURCES.length +
                    PARTICIPATION_SOURCES.findIndex((item) => item.source === source)
            ];
        const rateOf = (source: ParticipationSource) => {
            const count = countOf(source);
            return count && total ? Math.round((count.users / total) * 100) : null;
        };
        return {
            ymd,
            label: axisLabel(ymd),
            rates: {
                ATTENDANCE: rateOf('ATTENDANCE'),
                MISSION: rateOf('MISSION'),
                GAME: rateOf('GAME'),
            },
            users: {
                ATTENDANCE: countOf('ATTENDANCE'),
                MISSION: countOf('MISSION'),
                GAME: countOf('GAME'),
            },
        };
    });

    return {
        rows,
        total,
        trend: {
            isPending: participants.isPending || activeUsers.isPending,
            isError: participants.isError || activeUsers.isError,
            hasData:
                total !== undefined && participants.counts.some((count) => count !== undefined),
            refetch: () => {
                participants.refetch();
                void activeUsers.refetch();
            },
        },
    };
}
