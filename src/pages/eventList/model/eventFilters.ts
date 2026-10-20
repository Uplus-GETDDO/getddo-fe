import type { EventStatus } from '@entities/event';

// 필터 칩 — '전체' 외에는 이벤트 tags에 같은 이름이 있으면 해당 칩에 노출한다.
// 경품 성격으로 나눈다. 응모권 사용 여부는 requiredTickets로 판단하므로 칩에 넣지 않는다.
export const EVENT_FILTERS = [
    '전체',
    '디지털기기',
    '기프티콘·상품권',
    '한정 굿즈',
    '데이터·통신',
    '멤버십 혜택',
] as const;

export type EventFilter = (typeof EVENT_FILTERS)[number];

// 서버 페이지네이션 형식이 미합의(CONTEXT.md)라 전체 목록을 받아 프론트에서 나눈다
export const PAGE_SIZE = 12;

/**
 * 상태 탭 — 이벤트 상태 네 가지를 사용자가 읽는 세 갈래로 묶는다.
 * 마감(closed)과 발표 완료(drawn)는 둘 다 '응모가 끝난 이벤트'라 한 탭에 담고,
 * 그 안에서 발표 여부는 카드의 상태 표시로 가른다.
 */
export const EVENT_TABS = [
    { value: 'open', label: '진행 중' },
    { value: 'upcoming', label: '오픈 예정' },
    { value: 'past', label: '지난 이벤트' },
] as const;

export type EventTab = (typeof EVENT_TABS)[number]['value'];

/** 탭이 담는 이벤트 상태 */
export const TAB_STATUSES: Record<EventTab, readonly EventStatus[]> = {
    open: ['open'],
    upcoming: ['upcoming'],
    past: ['closed', 'drawn'],
};

/**
 * 정렬 — 모두 이벤트 응답(E01)이 들고 있는 값으로만 계산한다.
 * 응모자 수(인기순)는 E03 전용 조회라 목록에 없다. 이벤트마다 부르면 요청이 장수만큼 늘어난다.
 */
export const EVENT_SORTS = [
    { value: 'latest', label: '최신순' },
    { value: 'closing', label: '마감 임박순' },
    { value: 'winners', label: '당첨 인원순' },
] as const;

export type EventSort = (typeof EVENT_SORTS)[number]['value'];
