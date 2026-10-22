import { z } from 'zod';

// 이번 계약에서 차단 대상 요청 종류는 ENTRY(이벤트 응모 요청) 하나다 (getddo-spec 05-api/abuse.md)
export const abuseSourceTypeSchema = z.literal('ENTRY');
// 차단 판정 유형 — 일반 빈도 제한 거절의 반복 누적만 이번 범위다
export const abuseDetectionTypeSchema = z.literal('REPEATED_RATE_LIMIT_EXCEEDED');

// 차단 판정 기준 범위 — USER=사용자 전체 기준, EVENT=같은 이벤트 기준
export const abuseTriggerScopeSchema = z.enum(['USER', 'EVENT']);

// spec AR02의 evidence — 차단 판정 근거의 관리자 전용 구조. 세부 필드명은 담당자 검토 대기 제안을 그대로 따른다
export const abuseCaseEvidenceSchema = z.object({
    ruleVersion: z.string(),
    triggerScope: abuseTriggerScopeSchema,
    windowStartedAt: z.iso.datetime(),
    windowEndsAt: z.iso.datetime(),
    requestLimit: z.number().int(),
    rejectedCount: z.number().int(),
    rejectionThreshold: z.number().int(),
});

/**
 * 응모 자동 일시 차단 이력 — spec AR01의 AbuseCaseSummary.
 * eventId·eventTitle은 ? 필드라 응답에서 생략되지 않고 없으면 null이다
 */
export const abuseCaseSchema = z.object({
    id: z.uuid(),
    userId: z.uuid(),
    /** 조회 시 사용자 정보에서 조인해 제공하는 표시 닉네임 */
    userNickname: z.string(),
    /** 차단을 유발한 관련 이벤트 — 사용자 전체 차단을 해당 이벤트로 한정하는 값이 아니다 */
    eventId: z.uuid().nullable(),
    eventTitle: z.string().nullable(),
    sourceType: abuseSourceTypeSchema,
    detectionType: abuseDetectionTypeSchema,
    /** 관리자가 읽을 수 있는 차단 사유 — 일반 사용자 안내에 쓰지 않는다 */
    detectionReason: z.string(),
    blockedAt: z.iso.datetime(),
    /** 차단 종료 예정 시각 — Redis의 실제 현재 차단 상태 보장 값이 아니다 */
    blockedUntil: z.iso.datetime(),
});

// spec AR02의 AbuseCaseDetail — 요약 필드 전부에 관리자 전용 evidence 객체를 덧붙인다
export const abuseCaseDetailSchema = abuseCaseSchema.extend({
    evidence: abuseCaseEvidenceSchema,
});

export const ABUSE_SOURCE_TYPE_LABEL: Record<AbuseSourceType, string> = {
    ENTRY: '이벤트 응모',
};

export const ABUSE_DETECTION_TYPE_LABEL: Record<AbuseDetectionType, string> = {
    REPEATED_RATE_LIMIT_EXCEEDED: '빈도 제한 반복 초과',
};

export const ABUSE_TRIGGER_SCOPE_LABEL: Record<AbuseTriggerScope, string> = {
    USER: '사용자 전체 기준',
    EVENT: '이벤트 기준',
};

export type AbuseSourceType = z.infer<typeof abuseSourceTypeSchema>;
export type AbuseDetectionType = z.infer<typeof abuseDetectionTypeSchema>;
export type AbuseTriggerScope = z.infer<typeof abuseTriggerScopeSchema>;
export type AbuseCaseEvidence = z.infer<typeof abuseCaseEvidenceSchema>;
export type AbuseCase = z.infer<typeof abuseCaseSchema>;
export type AbuseCaseDetail = z.infer<typeof abuseCaseDetailSchema>;
