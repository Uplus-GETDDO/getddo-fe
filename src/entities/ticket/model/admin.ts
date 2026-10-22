import { z } from 'zod';

import { ticketHistorySchema, ticketStatusSchema } from './history';
import { ticketGradeSchema } from './types';

// 관리자 응모권 조회 계약 — 2026-10-12 백엔드(윤태형) 답변 기준이다.
// getddo-spec 05-api/ticket.md에는 아직 반영 전이므로 바뀌면 이 파일과 목업만 고친다

// AO03 — 지급 원본 구분
export const ticketSourceTypeSchema = z.enum(['ATTENDANCE', 'MISSION', 'GAME']);

// AO03 — 응모권 한 장의 지급 이력. 한 번의 보상으로 여러 장이면 장수만큼 행이 나온다
export const ticketGrantSchema = z.object({
    historyId: z.string(),
    ticketId: z.string(),
    userId: z.string(),
    userName: z.string(),
    grade: ticketGradeSchema,
    sourceType: ticketSourceTypeSchema,
    sourceId: z.string(),
    missionId: z.string().nullish(),
    grantedAt: z.iso.datetime({ offset: true }),
    expiresAt: z.iso.datetime({ offset: true }),
});

// AO05 — TicketHistory 전체 + 사용자·이벤트·미션 표시 이름 (해당 없으면 null)
export const adminTicketHistorySchema = ticketHistorySchema.extend({
    userId: z.string(),
    userName: z.string(),
    eventTitle: z.string().nullish(),
    missionTitle: z.string().nullish(),
});

// AO04 — 불일치 응모권 한 장. 응모권의 현재 버전·상태와 마지막 이력의 버전·상태가 다르다
export const ticketMismatchSchema = z.object({
    ticketId: z.string(),
    ticketVersion: z.number().int(),
    latestHistoryVersion: z.number().int(),
    ticketStatus: ticketStatusSchema,
    // 이력이 한 건도 없는 응모권은 마지막 이력 상태가 null이다 (spec AO04)
    latestHistoryStatus: ticketStatusSchema.nullable(),
});

export const ticketConsistencySchema = z.object({
    userId: z.string(),
    // ADR-028 표시용 현재 이름 — BE 미배포라 생략·null을 허용한다
    userName: z.string().nullish(),
    availableCount: z.number().int().nonnegative(),
    isConsistent: z.boolean(),
    inconsistencies: z.array(ticketMismatchSchema),
    checkedAt: z.iso.datetime({ offset: true }),
});

// AO09 — 전체 불일치 목록의 한 행 (불일치한 응모권만 담긴다)
export const ticketInconsistencySchema = ticketMismatchSchema.extend({
    userId: z.string(),
    userName: z.string(),
    grade: ticketGradeSchema,
    checkedAt: z.iso.datetime({ offset: true }),
});

// AO08 — 반환은 이벤트 취소와 같은 트랜잭션에서 즉시 끝나므로 처리 상태·재시도 횟수가 없다
export const ticketRefundReasonSchema = z.enum(['EVENT_CANCELED']);

export const ticketRefundSchema = z.object({
    id: z.string(),
    spendHistoryId: z.string(),
    ticketId: z.string(),
    grade: ticketGradeSchema,
    eventId: z.string(),
    eventTitle: z.string(),
    userId: z.string(),
    userName: z.string(),
    reasonType: ticketRefundReasonSchema,
    refundedAt: z.iso.datetime({ offset: true }),
    // 반환 대상 이력에 만료 시각이 없으면 null이다 (spec AO08)
    targetExpiresAt: z.iso.datetime({ offset: true }).nullable(),
});

export type TicketSourceType = z.infer<typeof ticketSourceTypeSchema>;
export type TicketGrant = z.infer<typeof ticketGrantSchema>;
export type AdminTicketHistory = z.infer<typeof adminTicketHistorySchema>;
export type TicketMismatch = z.infer<typeof ticketMismatchSchema>;
export type TicketConsistency = z.infer<typeof ticketConsistencySchema>;
export type TicketInconsistency = z.infer<typeof ticketInconsistencySchema>;
export type TicketRefund = z.infer<typeof ticketRefundSchema>;

export const TICKET_SOURCE_TYPE_LABEL: Record<TicketSourceType, string> = {
    ATTENDANCE: '출석',
    MISSION: '미션',
    GAME: '게임',
};

export const TICKET_STATUS_LABEL: Record<z.infer<typeof ticketStatusSchema>, string> = {
    AVAILABLE: '사용 가능',
    RETURNED: '반환됨',
    SPENT: '사용됨',
    EXPIRED: '만료',
};

export const TICKET_OPERATION_LABEL: Record<
    z.infer<typeof ticketHistorySchema>['operationType'],
    string
> = {
    GRANT: '지급',
    USE: '사용',
    REFUND: '반환',
    EXPIRE: '만료',
    CORRECTION: '정정',
};

export const TICKET_REFUND_REASON_LABEL: Record<
    z.infer<typeof ticketRefundReasonSchema>,
    string
> = {
    EVENT_CANCELED: '이벤트 취소',
};
