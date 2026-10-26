import type { AdminEventStatus } from '@entities/event';

import { useAdminEventStatusCounts } from '@entities/event';

export type EventStageKey = 'scheduled' | 'open' | 'draw' | 'publish' | 'done';

export interface EventStage {
    key: EventStageKey;
    label: string;
    /** 단계에 묶인 상태를 짧게 */
    hint: string;
    statuses: readonly AdminEventStatus[];
    /** 칸을 누르면 여는 화면 */
    to: string;
}

/**
 * 이벤트 상태 9가지를 운영 단계 5개로 묶는다 — 도넛 칸이 잘게 쪼개지지 않게, 관리자가 손댈 단계 단위로 본다.
 * 추첨이 필요한 마감·재추첨과 발표 대기는 추첨 관리로, 나머지는 상태가 걸린 이벤트 목록으로 잇는다
 */
export const EVENT_STAGES: readonly EventStage[] = [
    {
        key: 'scheduled',
        label: '진행 예정',
        hint: '시작 전',
        statuses: ['SCHEDULED'],
        to: '/admin/events?status=SCHEDULED',
    },
    {
        key: 'open',
        label: '진행 중',
        hint: '응모 받는 중',
        statuses: ['OPEN'],
        to: '/admin/events?status=OPEN',
    },
    {
        key: 'draw',
        label: '추첨 필요',
        hint: '마감·재추첨 중',
        statuses: ['CLOSED', 'REDRAWING'],
        to: '/admin/draw',
    },
    {
        key: 'publish',
        label: '발표 대기',
        hint: '추첨 확정',
        statuses: ['DRAW_CONFIRMED'],
        to: '/admin/draw',
    },
    {
        key: 'done',
        label: '종료',
        hint: '발표·취소·응모자 없음',
        statuses: ['PUBLISHED', 'CANCELED', 'NO_ENTRANTS', 'NO_ELIGIBLE_ENTRANTS'],
        to: '/admin/events?status=PUBLISHED',
    },
];

const STATUSES = EVENT_STAGES.flatMap((stage) => stage.statuses);

/** 단계별 이벤트 수 — 상태별 건수를 받아 단계로 더한다 */
export function useEventStageCounts() {
    const { counts, ...status } = useAdminEventStatusCounts(STATUSES);
    const byStatus = new Map(STATUSES.map((value, index) => [value, counts[index] ?? 0]));
    return {
        stages: EVENT_STAGES.map((stage) => ({
            ...stage,
            count: stage.statuses.reduce((sum, value) => sum + (byStatus.get(value) ?? 0), 0),
        })),
        ...status,
    };
}
