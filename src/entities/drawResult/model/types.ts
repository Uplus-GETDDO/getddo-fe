import { z } from 'zod';

// getddo-spec 05-api/drawing.md의 PublicResults — 공개 결과 조회(E08) 계약
// NO_ELIGIBLE_ENTRANTS는 신규 응답에서 생성하지 않지만, 과거 응답 파싱이 깨지지 않도록 값만 남긴다 (ADR-018)
export const drawDisplayStatusSchema = z.enum([
    'WAITING',
    'PUBLISHED',
    'CANCELED',
    'NO_ENTRANTS',
    'NO_ELIGIBLE_ENTRANTS',
]);

/**
 * 공개된 당첨자.
 *
 * 서버가 마스킹해서 내려준다 — 원본 개인정보·사용자 ID·가중치·검토 사유는 담기지 않는다.
 * 화면에서 다시 가리거나 풀지 않고 받은 값을 그대로 쓴다 (마스킹 규칙은 담당자 계약).
 */
export const maskedWinnerSchema = z.object({
    maskedName: z.string(),
    maskedPhoneNum: z.string().nullable().optional(),
    maskedEmail: z.string().nullable().optional(),
});

export const publishedPrizeSchema = z.object({
    prizeId: z.string(),
    rank: z.number().int().positive(),
    name: z.string(),
    winnerCount: z.number().int().nonnegative(),
    /** 후보 부족으로 확정된 미충원 자리 — 재추첨·확인 대기를 여기에 넣지 않는다 */
    unfilledCount: z.number().int().nonnegative(),
    winners: z.array(maskedWinnerSchema),
});

/**
 * 이벤트의 공개 추첨 결과.
 *
 * 발표 전에는 isPublished=false, prizes=[]다. 발표 예정 시각은 계약에 없다(ADR-022 수동 공개) —
 * 공개 여부는 isPublished·displayStatus로만 판단하고, 실제 공개 시각은 publishedAt이다.
 */
export const publicResultsSchema = z.object({
    eventId: z.string(),
    isPublished: z.boolean(),
    publishedAt: z.iso.datetime({ offset: true }).nullable(),
    revision: z.number().int().nullable(),
    updatedAt: z.iso.datetime({ offset: true }).nullable(),
    serverTime: z.iso.datetime({ offset: true }),
    displayStatus: drawDisplayStatusSchema,
    prizes: z.array(publishedPrizeSchema),
});

// getddo-spec 05-api/event.md의 Prize — E09가 당첨 경품으로 돌려주는 모양이다
export const prizeSchema = z.object({
    id: z.string(),
    rank: z.number().int().positive(),
    name: z.string(),
    description: z.string().nullable().optional(),
    imageUrl: z.string().nullable().optional(),
    winnerCount: z.number().int().nonnegative(),
});

/**
 * 본인 결과 상태 (E09).
 *
 * PENDING은 '응모했고 아직 공개 전'이다. 추첨이 끝났더라도 공개 전이면 서버가 PENDING을
 * 유지하므로(05-api/drawing.md), 화면이 이 값만 보고 그려도 발표 전에 당첨 여부가 새지 않는다.
 */
export const myResultStatusSchema = z.enum(['NOT_ENTERED', 'PENDING', 'WON', 'LOST', 'CANCELED']);

/**
 * 로그인한 본인의 이벤트 결과 (E09 `GET /events/{eventId}/my-result`).
 *
 * 공개 명단(E08)과 달리 본인 것만 담기므로 마스킹이 없다. 당첨이 아니면 prize는 null이다.
 */
export const myResultSchema = z.object({
    eventId: z.string(),
    result: myResultStatusSchema,
    prize: prizeSchema.nullable(),
    isPublished: z.boolean(),
    // 공개 명단이 수정된 횟수 — 공개 전에는 null이다
    revision: z.number().int().nullable(),
    serverTime: z.iso.datetime({ offset: true }),
});

export type DrawDisplayStatus = z.infer<typeof drawDisplayStatusSchema>;
export type MaskedWinner = z.infer<typeof maskedWinnerSchema>;
export type PublishedPrize = z.infer<typeof publishedPrizeSchema>;
export type PublicResults = z.infer<typeof publicResultsSchema>;
export type Prize = z.infer<typeof prizeSchema>;
export type MyResultStatus = z.infer<typeof myResultStatusSchema>;
export type MyResult = z.infer<typeof myResultSchema>;

// ── 관리자 추첨 관리(GD-125) — getddo-spec 05-api/drawing.md AD01~AD09 ──
// 추첨 실행 상태 — getddo-spec 05-api/drawing.md DrawRun.
// NO_ENTRIES는 spec 확정 값, NO_CANDIDATES는 BE 현행 값이다 (계약 확인 중 — GD-215)
export const drawRunStatusSchema = z.enum([
    'PREPARING',
    'READY',
    'RUNNING',
    'CONFIRMED',
    'FAILED',
    'NO_ENTRIES',
    'NO_CANDIDATES',
]);
export const drawTypeSchema = z.enum(['INITIAL', 'REPLACEMENT']);

export const drawRunSchema = z.object({
    id: z.string(),
    eventId: z.string(),
    runNumber: z.number().int(),
    // 최초/재추첨 종류 — 자동 실행인지 관리자가 시작·재개했는지는 이 필드로 추정하지 않는다
    drawType: drawTypeSchema,
    status: drawRunStatusSchema,
    // 이벤트의 최초 실행 ID — 시간상 직전 실행이나 취소 원본 실행이 아니다
    originalDrawId: z.string().nullable(),
    startedAt: z.iso.datetime({ offset: true }).nullable(),
    confirmedAt: z.iso.datetime({ offset: true }).nullable(),
    createdAt: z.iso.datetime({ offset: true }),
});

/**
 * AD02 실행 상세의 취소 근거 요약 — 해당 실행을 발생시킨 취소와 그 실행의 결과가
 * 이후 취소된 근거를 함께 담는다. resultId는 취소된 결과, replacementRunId는
 * 그 취소에 연결된 재추첨 실행(취소 원본 실행 ID와 다르다)
 */
export const cancellationSummarySchema = z.object({
    id: z.string(),
    resultId: z.string(),
    replacementRunId: z.string().nullable(),
    canceledBy: z.string(),
    reason: z.string(),
    canceledAt: z.iso.datetime({ offset: true }),
});

export const drawResultSchema = z.object({
    id: z.string(),
    prizeId: z.string(),
    prizeRank: z.number().int(),
    slotNumber: z.number().int(),
    selectionOrder: z.number().int().nullable(),
    resultType: z.enum(['SELECTED', 'UNFILLED']),
    candidateId: z.string().nullable(),
    userId: z.string().nullable(),
    // 실제 공개 명단에 반영된 이력 — 현재 명단 포함 여부가 아니다
    wasPublished: z.boolean(),
    isCanceled: z.boolean(),
});

// GET /admin/draws/{drawId}/failures 항목 — message는 코드에 대응하는 관리자용 안내이며 원문 예외·스택이 아니다
export const drawFailureSchema = z.object({
    id: z.string(),
    runId: z.string(),
    failureCode: z.string(),
    message: z.string(),
    failedAt: z.iso.datetime({ offset: true }),
    traceId: z.string().nullable(),
});

// GET /admin/draws/{drawId}/execution-audits 항목 — beforeData/afterData는 JSON이 아닌 문자열로 온다
export const drawExecutionAuditSchema = z.object({
    id: z.string(),
    actorId: z.string().nullable(),
    action: z.string(),
    reason: z.string().nullable(),
    beforeData: z.string().nullable(),
    afterData: z.string().nullable(),
    requestId: z.string().nullable(),
    createdAt: z.iso.datetime({ offset: true }),
});

/**
 * 실행 요약 — 실패 정보와 취소 근거를 중첩으로 제공한다.
 * retryAt이 있으면 자동 재시도 예약, 없고 FAILED면 waitingForOperator(운영자 대기)다.
 */
export const drawExecutionSummarySchema = z.object({
    failureCount: z.number().int(),
    latestFailure: drawFailureSchema.nullable(),
    retryAt: z.iso.datetime({ offset: true }).nullable(),
    waitingForOperator: z.boolean(),
    cancellations: z.array(cancellationSummarySchema),
});

export const drawRunDetailSchema = drawRunSchema.extend({
    algorithmVersion: z.string().nullable(),
    rulesSnapshot: z.record(z.string(), z.unknown()).nullable(),
    snapshotFixedAt: z.iso.datetime({ offset: true }).nullable(),
    results: z.array(drawResultSchema),
    execution: drawExecutionSummarySchema,
});

// ticketCount는 실제 차감 장수, weight는 등급 가중치 합(브론즈 1·실버 3·골드 5)으로 서로 다른 값이다
export const drawCandidateSchema = z.object({
    id: z.string(),
    participantId: z.string(),
    userId: z.string(),
    ticketCount: z.number().int(),
    weight: z.number().int(),
    entrySnapshot: z.record(z.string(), z.unknown()),
    eligibilitySnapshot: z.record(z.string(), z.unknown()),
});

export const drawVerificationSchema = z.object({
    id: z.string(),
    drawRunId: z.string(),
    passed: z.boolean(),
    checks: z.array(z.object({ code: z.string(), passed: z.boolean(), message: z.string() })),
    verifiedAt: z.iso.datetime({ offset: true }),
    verifiedBy: z.string(),
});

// 확정 결과 항목 — getddo-spec 05-api/drawing.md GD-138 절(AD09)·GD-87 절(최초 재개). DrawResult와 필드명이 다르다(resultId·rank)
export const drawConfirmationResultSchema = z.object({
    resultId: z.string(),
    prizeId: z.string(),
    rank: z.number().int(),
    slotNumber: z.number().int(),
    selectionOrder: z.number().int().nullable(),
    candidateId: z.string().nullable(),
    userId: z.string().nullable(),
    resultType: z.enum(['SELECTED', 'UNFILLED']),
});

export const drawConfirmationSchema = z.object({
    confirmedAt: z.iso.datetime({ offset: true }),
    results: z.array(drawConfirmationResultSchema),
});

/**
 * 추첨 실행 시작·재개 응답 (최초 재개 `POST /admin/draws/{runId}/resume`, AD09 공통).
 * confirmation은 확정 전 null이고, 확정(200)이면 저장된 결과를 그대로 돌려준다 — 202는 확정 성공을 보장하지 않는다.
 */
export const drawExecutionResponseSchema = z.object({
    runId: z.string(),
    status: drawRunStatusSchema,
    confirmation: drawConfirmationSchema.nullable(),
});

/**
 * GD-199 최초 발표 응답 (`POST /admin/draws/{runId}/result-confirmation`, 본문 없음).
 * 최초 발표의 정상 성공은 isPublished=true + 실제 공개 식별자·버전·시각이다.
 * confirmedBy/confirmedAt은 요청 실행의 확인 기록이라 실제 발표자와 다를 수 있다 —
 * 실제 발표자·시각은 공개 버전(PublicListChange)의 confirmedBy/confirmedAt으로 확인한다.
 */
export const drawResultConfirmationSchema = z.object({
    eventId: z.string(),
    confirmationId: z.string(),
    runId: z.string(),
    confirmedBy: z.string(),
    confirmedAt: z.iso.datetime({ offset: true }),
    isPublished: z.boolean(),
    publicationId: z.string().nullable(),
    revision: z.number().int().nullable(),
    publishedAt: z.iso.datetime({ offset: true }).nullable(),
});

export type DrawRunStatus = z.infer<typeof drawRunStatusSchema>;
export type DrawType = z.infer<typeof drawTypeSchema>;
export type DrawRun = z.infer<typeof drawRunSchema>;
export type CancellationSummary = z.infer<typeof cancellationSummarySchema>;
export type DrawResult = z.infer<typeof drawResultSchema>;
export type DrawFailure = z.infer<typeof drawFailureSchema>;
export type DrawExecutionAudit = z.infer<typeof drawExecutionAuditSchema>;
export type DrawExecutionSummary = z.infer<typeof drawExecutionSummarySchema>;
export type DrawRunDetail = z.infer<typeof drawRunDetailSchema>;
export type DrawCandidate = z.infer<typeof drawCandidateSchema>;
export type DrawVerification = z.infer<typeof drawVerificationSchema>;
export type DrawConfirmationResult = z.infer<typeof drawConfirmationResultSchema>;
export type DrawConfirmation = z.infer<typeof drawConfirmationSchema>;
export type DrawExecutionResponse = z.infer<typeof drawExecutionResponseSchema>;
export type DrawResultConfirmation = z.infer<typeof drawResultConfirmationSchema>;
