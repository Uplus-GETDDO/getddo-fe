import type { Event } from '../model/types';

/** 상세 화면 주소 — 겟또타임(타임래플)은 겟또타임 상세, 그 밖의 이벤트는 이벤트 상세로 간다 */
export function eventDetailPath(event: Pick<Event, 'id' | 'isTimeRaffle'>): string {
    return event.isTimeRaffle ? `/time-raffle/${event.id}` : `/events/${event.id}`;
}
