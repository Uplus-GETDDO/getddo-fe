import { z } from 'zod';

// getddo-spec 05-api/drawing.md — 당첨 취소·공개 명단 갱신 DTO (검토 대기 초안)

/** AD05 취소 사유 길이 — 양끝 공백을 제거한 뒤 1~1000자 (GD-138 확정) */
export const AWARD_CANCELLATION_REASON_MAX_LENGTH = 1000;

// AD05 요청 본문 — trim 후 길이를 검사하고 변환된(공백 제거된) 값을 쓴다
export const awardCancellationRequestSchema = z.object({
    reason: z.string().trim().min(1).max(AWARD_CANCELLATION_REASON_MAX_LENGTH),
});

// AD05 응답. status는 연결된 재추첨 실행의 현재 상태다
export const awardCancellationResultSchema = z.object({
    cancellationId: z.string(),
    canceledDrawResultId: z.string(),
    replacementDrawRunId: z.string(),
    status: z.enum(['PREPARING', 'READY', 'RUNNING', 'CONFIRMED', 'FAILED']),
    canceledAt: z.iso.datetime(),
});

// AD06 응답
export const publicationUpdateResultSchema = z.object({
    eventId: z.string(),
    publicationId: z.string(),
    drawRunId: z.string(),
    revision: z.number().int(),
    publishedAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
    updatedBy: z.string(),
    // ADR-028 표시용 갱신 처리자 현재 이름 — BE 미배포라 생략·null을 허용한다
    updatedByName: z.string().nullish(),
});

// AD07 executions[]의 취소 근거 — 해당 공개 버전에 반영된 실행에 연결된 취소의 사유
export const publicationCancellationSchema = z.object({
    id: z.string(),
    resultId: z.string(),
    reason: z.string(),
});

// AD07 executions[] — 공개 버전에 반영된 실행별 확인 근거 (실행 번호 오름차순)
export const publicationExecutionSchema = z.object({
    runId: z.string(),
    confirmationId: z.string(),
    confirmedBy: z.string(),
    confirmedByName: z.string().nullish(),
    confirmedAt: z.iso.datetime(),
    cancellations: z.array(publicationCancellationSchema),
});

/**
 * AD07 항목 — 공개 버전 간 변경 대상의 전후 정보.
 * 과거 INITIAL 공개는 확인자·시각·사유가 없을 수 있어 null을 보존하고,
 * 과거 근거가 없으면 executions=[]일 수 있다.
 */
export const publicListChangeSchema = z.object({
    id: z.string(),
    publicationId: z.string(),
    revision: z.number().int(),
    drawRunId: z.string(),
    reason: z.string().nullable(),
    confirmedBy: z.string().nullable(),
    // ADR-028 표시용 처리자 현재 이름 — 과거 확인자 정보가 없으면 confirmedBy와 함께 null이다
    confirmedByName: z.string().nullish(),
    confirmedAt: z.iso.datetime().nullable(),
    updatedAt: z.iso.datetime(),
    changes: z.array(
        z.object({
            prizeId: z.string(),
            slotNumber: z.number().int(),
            beforeUserId: z.string().nullable(),
            beforeUserName: z.string().nullish(),
            afterUserId: z.string().nullable(),
            afterUserName: z.string().nullish(),
        }),
    ),
    executions: z.array(publicationExecutionSchema),
});

export type AwardCancellationRequest = z.infer<typeof awardCancellationRequestSchema>;
export type AwardCancellationResult = z.infer<typeof awardCancellationResultSchema>;
export type PublicationUpdateResult = z.infer<typeof publicationUpdateResultSchema>;
export type PublicationCancellation = z.infer<typeof publicationCancellationSchema>;
export type PublicationExecution = z.infer<typeof publicationExecutionSchema>;
export type PublicListChange = z.infer<typeof publicListChangeSchema>;
