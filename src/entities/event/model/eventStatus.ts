import type { AdminEventStatus } from './adminTypes';

/**
 * 더 이상 전이하지 않는 이벤트 종결 상태 (spec 원시 상태 기준).
 *
 * PUBLISHED·NO_ENTRANTS·NO_ELIGIBLE_ENTRANTS는 발표가 끝난 상태, CANCELED는 취소 확정이다.
 * DRAW_CONFIRMED·REDRAWING은 화면상 'closed'로 보여도 발표(PUBLISHED) 전이가 남아 있어
 * 종결이 아니다 — 상세 폴링 종료 조건처럼 "전이가 끝났는가"를 묻는 곳에서 쓴다 (ADR-0007).
 */
export function isFinalEventStatus(status: AdminEventStatus): boolean {
    return (
        status === 'PUBLISHED' ||
        status === 'NO_ENTRANTS' ||
        status === 'NO_ELIGIBLE_ENTRANTS' ||
        status === 'CANCELED'
    );
}
