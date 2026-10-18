import type { AdminEventStatus } from '../model/adminTypes';
import type { EventDetailResponse, EventSummaryResponse } from '../model/contract';
import type { Event, EventStatus } from '../model/types';

// spec의 원시 상태 → 화면 상태.
// REDRAWING·CANCELED는 화면 상태에 대응값이 없다 — 마감 뒤 진행 상태이므로 closed로 근사한다
const SCREEN_STATUS: Record<AdminEventStatus, EventStatus> = {
    SCHEDULED: 'upcoming',
    OPEN: 'open',
    CLOSED: 'closed',
    DRAW_CONFIRMED: 'closed',
    REDRAWING: 'closed',
    PUBLISHED: 'drawn',
    NO_ENTRANTS: 'drawn',
    // 당첨 가능한 응모가 없어 발표가 끝난 상태 — 화면에서는 발표 완료다
    NO_ELIGIBLE_ENTRANTS: 'drawn',
    CANCELED: 'closed',
};

/**
 * EventSummary에는 maxTicketsPerUser가 없다 — spec상 조합이 확정된 경우(미사용→null,
 * 가중치 미적용→1)만 채운다. 가중치 이벤트는 정수 상한과 null(월말 소진용·무제한)이
 * 모두 가능해 근사하지 않는다 — '5'로 어림하면 무제한 이벤트가 '5장'으로 잘못 읽힌다.
 * 상한 표시에는 상세(E02)의 실값만 쓴다 (getddo-spec 05-api/event.md)
 */
const fallbackMaxTickets = (raw: EventSummaryResponse): number | null | undefined =>
    raw.eventType === 'NO_TICKET' ? null : raw.weightingEnabled ? undefined : 1;

/**
 * spec 원시 응답(EventSummary·EventDetail)을 화면용 Event 뷰모델로 변환한다.
 * E01 목록에는 description·prizes가 없어 목록만으로 만든 이벤트는
 * prizeName·winnerCount가 undefined이고 description이 빈 문자열이다.
 */
export function toEvent(raw: EventSummaryResponse | EventDetailResponse): Event {
    const prizes = raw.prizes?.length ? [...raw.prizes].sort((a, b) => a.rank - b.rank) : undefined;
    const topPrize = prizes?.[0];

    return {
        id: raw.id,
        title: raw.title,
        description: raw.description ?? '',
        bannerImageUrl: raw.imageUrl,
        detailImageUrl: raw.detailImageUrl ?? undefined,
        detailVisual: raw.detailVisual,
        startsAt: raw.startsAt,
        endsAt: raw.endsAt,
        status: SCREEN_STATUS[raw.status],
        // 추천 선정은 운영자 지정 값이라 파생할 근거가 없다 — 계약이 생기기 전까지 비워 둔다
        isRecommended: raw.isRecommended,
        // 타임래플 분류는 spec 필드가 없어 계약 확인 중이다 — 없으면 CONTEXT.md 용어 정의
        // ("타임래플 = 응모권 차감 이벤트")에 따라 응모권 사용 이벤트로 근사한다. 이 통칭보다
        // 좁은 "시간 한정" 래플이 별도로 생기면 계약 확정 시 기준을 좁힌다
        isTimeRaffle: raw.isTimeRaffle ?? raw.eventType === 'TICKET',
        raffleDetail: raw.raffleDetail,
        eventType: raw.eventType,
        weightingEnabled: raw.weightingEnabled,
        maxTicketsPerUser:
            'maxTicketsPerUser' in raw ? raw.maxTicketsPerUser : fallbackMaxTickets(raw),
        membershipRule: raw.membershipRule,
        // 1회 응모의 차감 장수 — 가중치 이벤트는 장수를 사용자가 고르므로 최소 1장으로 둔다
        requiredTickets: raw.eventType === 'TICKET' ? 1 : 0,
        tags: raw.tags,
        prizeName:
            topPrize && prizes
                ? prizes.length > 1
                    ? `${topPrize.name} 외 ${prizes.length - 1}종`
                    : topPrize.name
                : undefined,
        winnerCount: prizes?.reduce((sum, prize) => sum + prize.winnerCount, 0),
        myEntered: 'maxTicketsPerUser' in raw ? false : (raw.myEntered ?? false),
        myEntryCount: raw.myEntryCount,
        myTicketCount: raw.myTicketCount,
    };
}
