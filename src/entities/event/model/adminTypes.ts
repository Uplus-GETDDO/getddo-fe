import { z } from 'zod';

// 관리자 이벤트 상태 — getddo-spec 05-api/event.md의 EventStatus 원문 (사용자용 단순화 enum과 별개)
export const adminEventStatusSchema = z.enum([
    'SCHEDULED',
    'OPEN',
    'CLOSED',
    'DRAW_CONFIRMED',
    'PUBLISHED',
    'CANCELED',
    'REDRAWING',
    'NO_ENTRANTS',
    // 신규 응답에서 생성하지 않는 과거 값 — 기존 응답 파싱 호환용 (ADR-018)
    'NO_ELIGIBLE_ENTRANTS',
]);

export const eventTypeSchema = z.enum(['NO_TICKET', 'TICKET']);
export const membershipRuleSchema = z.enum(['excellent', 'vip', 'vvip']);

export const adminPrizeSchema = z.object({
    id: z.string(),
    rank: z.number().int().min(1),
    name: z.string(),
    description: z.string().nullable(),
    imageUrl: z.string().nullable(),
    winnerCount: z.number().int().min(1),
});

// AE01/AE02 응답 — AdminEvent = EventDetail + 감사 필드 (spec 초안, 검토 대기)
export const adminEventSchema = z.object({
    id: z.string(),
    title: z.string(),
    description: z.string(),
    imageUrl: z.string().nullable(),
    imageKey: z.string().nullable(),
    eventType: eventTypeSchema,
    weightingEnabled: z.boolean(),
    maxTicketsPerUser: z.number().int().nullable(),
    membershipRule: membershipRuleSchema,
    startsAt: z.iso.datetime(),
    endsAt: z.iso.datetime(),
    status: adminEventStatusSchema,
    // 마감+5분 최초 자동 추첨 기준 — 공개 예정이 아니다 (ADR-022, GD-203)
    drawScheduledAt: z.iso.datetime(),
    serverTime: z.iso.datetime(),
    prizes: z.array(adminPrizeSchema),
    /*
     * 경품 이미지의 저장 키 — prizes[].imageUrl과 같은 이미지를 가리키지만 쓰임이 다르다.
     * imageUrl은 화면에 보여 줄 주소이고, 이쪽은 수정 요청에 다시 실어 기존 연결을 지키는 키다.
     * 이 스키마를 쓰는 AE01~AE04 네 응답 모두 싣는 것을 실서버로 확인했다 (2026-10-21).
     */
    prizeImages: z.array(z.object({ prizeId: z.string(), imageKey: z.string().nullable() })),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
    canceledAt: z.iso.datetime().nullable(),
});

// AE03/AE04 요청 본문 — EventWriteRequest (spec 초안). 응답과 달리 쓰기용이라 Zod 검증 없이 타입만 둔다
export interface PrizeWrite {
    id?: string;
    rank: number;
    name: string;
    winnerCount: number;
    description: string | null;
    imageKey: string | null;
}

export interface EventWriteRequest {
    title: string;
    description: string;
    imageKey: string | null;
    eventType: EventType;
    weightingEnabled: boolean;
    /** 미사용 null, 미가중치 1, 일반 가중치 5, 월말 소진용 null — 조합 검증은 서버가 한다 */
    maxTicketsPerUser: number | null;
    membershipRule: MembershipRule;
    startsAt: string;
    endsAt: string;
    prizes: PrizeWrite[];
}

// AE08 상태 운영 응답
export const eventOperationResultSchema = z.object({
    eventId: z.string(),
    previousStatus: adminEventStatusSchema,
    status: adminEventStatusSchema,
    refundedTicketCount: z.number().int(),
    processedAt: z.iso.datetime(),
});

export type AdminEventStatus = z.infer<typeof adminEventStatusSchema>;
export type EventType = z.infer<typeof eventTypeSchema>;
export type MembershipRule = z.infer<typeof membershipRuleSchema>;
export type AdminPrize = z.infer<typeof adminPrizeSchema>;
export type AdminEvent = z.infer<typeof adminEventSchema>;
export type EventOperationResult = z.infer<typeof eventOperationResultSchema>;
