import type { Event } from '@entities/event';

import type { EventSort, EventTab } from '../model/eventFilters';

import { EVENT_SORTS, EVENT_TABS, TAB_STATUSES } from '../model/eventFilters';

/** 주소의 tab 값을 읽는다 — 모르는 값이면 진행 중으로 돌린다 */
export function readEventTab(value: string | null): EventTab {
    return EVENT_TABS.find((tab) => tab.value === value)?.value ?? 'open';
}

/** 주소의 sort 값을 읽는다 — 모르는 값이면 최신순으로 돌린다 */
export function readEventSort(value: string | null): EventSort {
    return EVENT_SORTS.find((sort) => sort.value === value)?.value ?? 'latest';
}

// 시작·마감 시각은 ISO 8601 UTC 문자열이라 문자열 비교로 시각 비교가 된다
const SORTERS: Record<EventSort, (a: Event, b: Event) => number> = {
    latest: (a, b) => b.startsAt.localeCompare(a.startsAt),
    closing: (a, b) => a.endsAt.localeCompare(b.endsAt),
    /*
     * 당첨 인원순 — 계약에 없는 화면 자체 정렬이다.
     *
     * getddo-spec 05-api/event.md의 GD-251 절이 "당첨 인원순 정렬과 태그·추천 필드는 이번
     * 계약에 추가하지 않는다"로 못 박았다. 서버가 정렬해 주지 않으므로 받아 온 페이지 안에서만
     * 다시 세운다 — 전체 목록 기준이 아니라 지금 페이지 기준이라는 뜻이다.
     * BE 정렬 계약이 생기면 쿼리 파라미터로 옮긴다.
     *
     * 당첨 인원은 서버가 늘 주지는 않는다 (GD-215) — 없는 건 0으로 봐 뒤로 보낸다.
     */
    winners: (a, b) => (b.winnerCount ?? 0) - (a.winnerCount ?? 0),
};

/**
 * 탭으로 거르고 정렬한다.
 *
 * 타임래플은 전용 화면(/time-raffle)에서 다루므로 이벤트 목록에서는 언제나 뺀다.
 * 원본 배열을 건드리지 않는다 — 쿼리 캐시가 들고 있는 배열이라 제자리 정렬하면 다른 화면이 같이 흔들린다.
 */
export function filterEvents(events: readonly Event[], tab: EventTab, sort: EventSort): Event[] {
    const statuses = TAB_STATUSES[tab];
    return events
        .filter((event) => !event.isTimeRaffle && statuses.includes(event.status))
        .sort(SORTERS[sort]);
}
