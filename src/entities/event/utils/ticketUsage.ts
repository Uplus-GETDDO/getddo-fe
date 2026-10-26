import type { Event } from '../model/types';

/**
 * 이 이벤트에 응모권을 어떻게 쓰는지 한 줄로 적는다.
 *
 * 세 갈래다 (getddo-spec 05-api/event.md · ADR-010).
 * - 미사용(NO_TICKET) — 응모권 없이 한 번
 * - 가중치 미적용(TICKET·weightingEnabled false) — 브론즈 1장으로 한 번
 * - 가중치 적용(TICKET·weightingEnabled true) — 등급을 골라 누적 상한까지 여러 번 나눠서
 *
 * requiredTickets를 그대로 적으면 안 된다. 가중치 이벤트에서도 1로 고정된 값이라서
 * (toEvent — 장수를 사용자가 고르므로 최소 1장으로 둔다) 나눠 낼 수 있는 래플이
 * '1회 1장'짜리로 읽힌다.
 */
export function describeTicketUsage(event: Event): string {
    if (event.eventType === 'NO_TICKET') return '응모권 없이 한 번 응모';
    if (!event.weightingEnabled) return '브론즈 1장으로 한 번 응모';

    // 상한 실값은 상세(E02)에만 있다 — 목록만으로 만든 이벤트는 장수를 단정하지 않는다
    if (event.maxTicketsPerUser === undefined) return '등급을 골라 응모';
    if (event.maxTicketsPerUser === null) return '등급을 골라 장수 제한 없이 나눠서 응모';
    // 상한이 1장이면 나눠 낼 자리가 없다 — '최대 1장까지 나눠서'는 말이 되지 않는다
    if (event.maxTicketsPerUser <= 1) return '등급을 골라 1장만 응모';
    return `등급을 골라 최대 ${event.maxTicketsPerUser}장까지 나눠서 응모`;
}
