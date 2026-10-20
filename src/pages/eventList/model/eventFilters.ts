import type { EventStatus } from '@entities/event';

/**
 * 한 쪽에 그릴 장수.
 *
 * 서버 페이지네이션은 있다 (`Page<T>` — items·page·size·totalElements, 05-api/common.md).
 * 그런데도 화면에서 다시 나누는 것은 useEventList가 totalElements까지 전부 모아 오기 때문이다.
 * 탭별로 가르고 전체를 기준으로 정렬하려면 한 쪽만으로는 안 되고, 홈·겟또타임도 같은 쿼리를 함께 쓴다.
 *
 * 이벤트가 수천 건이 되면 이 방식은 요청을 그만큼 반복한다 — 그때는 서버 정렬·서버 페이지네이션으로 옮긴다.
 */
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
