import type { Event } from '@entities/event';

/**
 * 홈 '발표 대기 · 결과'에 둘 이벤트 — 내가 응모했고 응모가 끝난 것.
 *
 * 남이 응모한 이벤트의 발표를 홈에서 기다릴 일은 없다. 마감(closed)과 발표 완료(drawn)를 함께 담고,
 * 줄마다 어느 쪽인지는 EventResultRow가 적는다.
 *
 * myEntered는 목록(E01)만 주므로 이 섹션은 목록 응답으로만 만든다 (getddo-spec 05-api/event.md R7).
 * 정상 접수가 있으면 참이라 이벤트가 취소되거나 응모권이 반환돼도 결과를 끝까지 따라갈 수 있다.
 */
export function myAwaitingResults(events: readonly Event[]): Event[] {
    return events.filter(
        (event) =>
            event.myEntered && ['closed', 'drawn', 'canceled', 'ended'].includes(event.status),
    );
}
