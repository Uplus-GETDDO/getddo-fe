import { z } from 'zod';

// getddo-spec/05-api/entry.md 초안의 EntryReceipt — 접수·거절 두 상태만 존재한다
export const entryStatusSchema = z.enum(['ACCEPTED', 'REJECTED']);

// 등급별 장수 맵 — spec의 응모 계약 키 집합(BRONZE·SILVER·GOLD·PLATINUM)이다.
// entities/ticket의 등급과 값은 같지만 응모 계약 소유 필드라 이 슬라이스에 둔다 (슬라이스 간 참조 금지)
export const ticketsByGradeSchema = z.object({
    BRONZE: z.number().int().nonnegative(),
    SILVER: z.number().int().nonnegative(),
    GOLD: z.number().int().nonnegative(),
    PLATINUM: z.number().int().nonnegative(),
});

// 응모 접수 결과 — 최종 접수 여부는 이 응답을 따른다 (화면에서 미리 확정하지 않는다)
// eventTitle은 목록에서 이벤트 이름을 보여주기 위해 서버가 함께 내려주는 필드다.
// 당첨 여부는 담기지 않는다 — 발표 전 당첨 정보는 비공개다 (docs/CONTEXT.md).
export const entrySchema = z.object({
    id: z.string(),
    eventId: z.string(),
    eventTitle: z.string(),
    /** 이번 응모로 요청한 응모권 수 — requestedTicketsByGrade의 합계다 */
    requestedTicketCount: z.number().int().nonnegative(),
    /** 등급별로 요청한 장수 — 0인 등급도 모두 포함한다 */
    requestedTicketsByGrade: ticketsByGradeSchema,
    /** 이번 응모로 실제 차감된 응모권 수 — deductedTicketsByGrade의 합계다 */
    deductedTicketCount: z.number().int().nonnegative(),
    /** 등급별로 차감된 장수 — 거절된 응모는 모두 0이다 */
    deductedTicketsByGrade: ticketsByGradeSchema,
    status: entryStatusSchema,
    requestedAt: z.iso.datetime(),
    acceptedAt: z.iso.datetime().nullable(),
    rejectionCode: z.string().nullable(),
    rejectionReason: z.string().nullable(),
});

// E03 EntryStatistics (getddo-spec/05-api/entry.md) — 당첨 확률은 계약에 없고 화면에도 노출하지 않는다
export const entryStatisticsSchema = z.object({
    eventId: z.string(),
    /** 접수 완료된 응모자 수(중복 제거) */
    participantCount: z.number().int().nonnegative(),
    /** 접수 완료 건의 차감 합계 — 반환을 빼지 않는다 */
    totalSpentTicketCount: z.number().int().nonnegative(),
    /** 내가 이 이벤트에 차감한 응모권 수 */
    mySpentTicketCount: z.number().int().nonnegative(),
    // 서버 시각은 UTC 또는 명시적 오프셋(+09:00 등)을 허용한다 (docs/CONTEXT.md)
    serverTime: z.iso.datetime({ offset: true }),
});

// E07 자격 조회의 불가 사유 — spec의 reasons 열거값이다
export const entryIneligibilityReasonSchema = z.enum([
    'ADMIN_ENTRY_FORBIDDEN',
    'ENTRY_MEMBERSHIP_NOT_MET',
    'EVENT_NOT_OPEN',
    'ALREADY_ENTERED',
    'TICKET_LIMIT_EXCEEDED',
    'BRONZE_REQUIRED',
    'INSUFFICIENT_TICKETS',
]);

// E07 EntryEligibility — 서버가 판정한 응모 가능 여부와 그 근거다
export const entryEligibilitySchema = z.object({
    eventId: z.string(),
    canEnter: z.boolean(),
    reasons: z.array(entryIneligibilityReasonSchema),
    /** 이 이벤트에 이미 차감한 장수 */
    usedTicketCount: z.number().int().nonnegative(),
    /** 앞으로 더 낼 수 있는 장수 — 사용자당 상한이 없는 이벤트는 null이다 */
    remainingTicketLimit: z.number().int().nonnegative().nullable(),
    /** 이 이벤트에서 실제로 쓸 수 있는 보유 장수 — 미적용 이벤트는 브론즈만 센다 */
    availableTicketBalance: z.number().int().nonnegative(),
    serverTime: z.iso.datetime({ offset: true }),
});

export type TicketsByGrade = z.infer<typeof ticketsByGradeSchema>;
// E04 요청 본문 — 생략된 등급은 0으로 본다 (spec EntryRequest)
export type EntryTickets = Partial<TicketsByGrade>;
export type EntryStatistics = z.infer<typeof entryStatisticsSchema>;
export type EntryIneligibilityReason = z.infer<typeof entryIneligibilityReasonSchema>;
export type EntryEligibility = z.infer<typeof entryEligibilitySchema>;
export type EntryStatus = z.infer<typeof entryStatusSchema>;
export type Entry = z.infer<typeof entrySchema>;

export const adminEntrySchema = entrySchema.extend({
    userId: z.uuid(),
    // ADR-028 표시용 현재 이름 — BE 미배포라 생략·null을 모두 허용하고, 동일인 판정은 userId로 한다
    userName: z.string().nullish(),
    participantId: z.uuid().nullable(),
});
export const adminParticipantSchema = z.object({
    id: z.uuid(),
    eventId: z.uuid(),
    userId: z.uuid(),
    userName: z.string().nullish(),
    usedTicketCount: z.number().int().nonnegative(),
    createdAt: z.iso.datetime(),
});
export type AdminEntry = z.infer<typeof adminEntrySchema>;
export type AdminParticipant = z.infer<typeof adminParticipantSchema>;
