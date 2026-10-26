import type { AdminEventStatus, EventType, MembershipRule } from './adminTypes';

// 관리자 상태 칩의 표시 메타 — 목록 테이블과 상세 화면이 함께 쓴다 (spec 05-api/event.md EventStatus)
// 색은 라이프사이클 의미로 묶는다 — pending 대기, active 진행/다음 단계 대기, revision 재처리 중,
// approved 완료, rejected 취소, neutral 종료·결과 없음
export const ADMIN_STATUS_META: Record<AdminEventStatus, { label: string; chipClass: string }> = {
    SCHEDULED: { label: '진행 예정', chipClass: 'bg-status-pending text-status-pending-text' },
    OPEN: { label: '진행 중', chipClass: 'bg-status-active text-status-active-text' },
    CLOSED: { label: '마감', chipClass: 'bg-surface-sunken text-fg-secondary' },
    DRAW_CONFIRMED: {
        label: '추첨 확정·발표 대기',
        chipClass: 'bg-status-active text-status-active-text',
    },
    PUBLISHED: { label: '발표 완료', chipClass: 'bg-status-approved text-status-approved-text' },
    CANCELED: { label: '취소', chipClass: 'bg-status-rejected text-status-rejected-text' },
    REDRAWING: { label: '재추첨 중', chipClass: 'bg-status-revision text-status-revision-text' },
    NO_ENTRANTS: { label: '응모자 없음', chipClass: 'bg-surface-sunken text-fg-secondary' },
    NO_ELIGIBLE_ENTRANTS: {
        label: '당첨자 없음',
        chipClass: 'bg-surface-sunken text-fg-secondary',
    },
};

export const EVENT_TYPE_LABEL: Record<EventType, string> = {
    NO_TICKET: '응모권 미사용',
    TICKET: '응모권 사용',
};

// 유형은 상태가 아닌 분류라 라이프사이클 색을 쓰지 않는다 — 응모권 사용은 브랜드 옅은 바탕(글자 대비가 충분), 미사용은 중립
export const EVENT_TYPE_CHIP: Record<EventType, string> = {
    NO_TICKET: 'bg-surface-sunken text-fg-secondary',
    TICKET: 'bg-brand-soft text-fg-brand',
};

export const MEMBERSHIP_LABEL: Record<MembershipRule, string> = {
    excellent: '우수',
    vip: 'VIP',
    vvip: 'VVIP',
};
