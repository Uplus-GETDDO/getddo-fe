import { z } from 'zod';

// getddo-spec/05-api/mission.md 초안 기준 — 계약 확정 전이라 초안과 다르게 바꿀 때는 먼저 합의한다
export const missionTypeSchema = z.enum(['SURVEY', 'QUIZ']);
export const missionQuestionTypeSchema = z.enum([
    'OX',
    'SINGLE_CHOICE',
    'SHORT_ANSWER',
    'FREE_TEXT',
]);

export const questionOptionSchema = z.object({
    id: z.string(),
    optionText: z.string(),
    displayOrder: z.number().int(),
});

export const missionQuestionSchema = z.object({
    id: z.string(),
    questionType: missionQuestionTypeSchema,
    questionText: z.string(),
    required: z.boolean(),
    displayOrder: z.number().int(),
    options: z.array(questionOptionSchema),
});

export const missionSummarySchema = z.object({
    id: z.string(),
    title: z.string(),
    imageUrl: z.string().nullish(),
    missionType: missionTypeSchema,
    startsAt: z.string(),
    endsAt: z.string(),
    rewardTicketCount: z.number().int().nonnegative(),
    completed: z.boolean(),
    serverTime: z.string(),
});

export const missionDetailSchema = missionSummarySchema.extend({
    description: z.string(),
    questions: z.array(missionQuestionSchema),
});

// 선택형 문항은 selectedOptionId만, 서술형은 answerText만 보내는 계약 (M03)
export const missionAnswerSchema = z
    .object({
        questionId: z.string(),
        selectedOptionId: z.string().optional(),
        answerText: z.string().optional(),
    })
    .refine((answer) => answer.selectedOptionId !== undefined || answer.answerText !== undefined, {
        message: '선택지 또는 답변 텍스트가 필요합니다',
    });

// 05-api/attendance.md의 RewardReceipt — 미션·게임·출석이 공유하는 보상 영수증
export const rewardReceiptSchema = z.object({
    claimId: z.string(),
    ticketCount: z.number().int(),
    /** 받은 응모권 등급 — 게임·미션 보상은 서버가 추첨한다 (BRONZE·SILVER·GOLD·PLATINUM, getddo-spec 응모권 등급 추첨) */
    grade: z.enum(['BRONZE', 'SILVER', 'GOLD', 'PLATINUM']).nullish(),
    grantedAt: z.string().nullish(),
    expiresAt: z.string().nullish(),
});

export const missionSubmissionResultSchema = z.object({
    submissionId: z.string(),
    missionId: z.string(),
    receivedAt: z.string(),
    isCompleted: z.boolean(),
    reward: rewardReceiptSchema.nullish(),
    createdAt: z.string(),
});

export type MissionType = z.infer<typeof missionTypeSchema>;
export type MissionQuestionType = z.infer<typeof missionQuestionTypeSchema>;
export type QuestionOption = z.infer<typeof questionOptionSchema>;
export type MissionQuestion = z.infer<typeof missionQuestionSchema>;
export type MissionSummary = z.infer<typeof missionSummarySchema>;
export type MissionDetail = z.infer<typeof missionDetailSchema>;
export type MissionAnswer = z.infer<typeof missionAnswerSchema>;
export type RewardReceipt = z.infer<typeof rewardReceiptSchema>;
export type MissionSubmissionResult = z.infer<typeof missionSubmissionResultSchema>;
