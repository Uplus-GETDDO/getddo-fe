import { z } from 'zod';

import { missionQuestionTypeSchema, missionTypeSchema } from './types';

const optionWrite = z.object({
    optionText: z.string().trim().min(1),
    displayOrder: z.number().int(),
    isCorrect: z.boolean().optional(),
});
const questionWrite = z.object({
    questionType: missionQuestionTypeSchema,
    questionText: z.string().trim().min(1),
    displayOrder: z.number().int(),
    required: z.boolean().optional(),
    correctAnswer: z.string().optional(),
    options: z.array(optionWrite).optional(),
});
const writeBase = z.object({
    title: z.string().trim().min(1).max(200),
    description: z.string(),
    missionType: missionTypeSchema,
    startsAt: z.iso.datetime({ offset: true }),
    endsAt: z.iso.datetime({ offset: true }),
    rewardTicketCount: z.literal(1),
    imageKey: z.string().max(500).nullable().optional(),
});
export const missionWriteSchema = writeBase
    .extend({ questions: z.array(questionWrite).min(1) })
    .superRefine((body, ctx) => {
        if (Date.parse(body.endsAt) <= Date.parse(body.startsAt))
            ctx.addIssue({
                code: 'custom',
                message: '종료는 시작보다 늦어야 합니다.',
                path: ['endsAt'],
            });
        body.questions.forEach((q, i) => {
            const quiz = body.missionType === 'QUIZ';
            const choice = q.questionType === 'OX' || q.questionType === 'SINGLE_CHOICE';
            const validType = quiz
                ? q.questionType !== 'FREE_TEXT'
                : ['SINGLE_CHOICE', 'FREE_TEXT'].includes(q.questionType);
            if (
                !validType ||
                (choice &&
                    ((q.options?.length ?? 0) < 2 ||
                        (quiz && q.options?.filter((o) => o.isCorrect).length !== 1))) ||
                (quiz && !choice && !q.correctAnswer?.trim()) ||
                (!quiz && q.required === undefined)
            ) {
                ctx.addIssue({
                    code: 'custom',
                    message: '문항 유형·선택지·정답·필수 여부를 확인해 주세요.',
                    path: ['questions', i],
                });
            }
        });
    });
export const adminMissionSummarySchema = writeBase.extend({
    id: z.string(),
    status: z.enum(['ACTIVE', 'ENDED']),
    rewardPolicyId: z.string(),
    createdBy: z.string(),
    createdAt: z.string(),
    updatedAt: z.string(),
});
export const adminMissionSchema = adminMissionSummarySchema.extend({
    questions: z.array(
        questionWrite.extend({
            id: z.string(),
            options: z.array(optionWrite.extend({ id: z.string() })).optional(),
        }),
    ),
});
export const surveySummarySchema = z.object({
    dailyResponses: z.array(
        z.object({ date: z.iso.date(), count: z.number().int().nonnegative() }),
    ),
    questions: z.array(
        z.object({
            questionId: z.string(),
            questionText: z.string(),
            options: z.array(
                z.object({
                    optionId: z.string(),
                    optionText: z.string(),
                    count: z.number().int().nonnegative(),
                }),
            ),
        }),
    ),
});
export const surveyRangeSchema = z
    .object({ from: z.iso.date(), to: z.iso.date() })
    .refine(({ from, to }) => {
        const days = (Date.parse(to) - Date.parse(from)) / 86_400_000;
        return days >= 0 && days <= 30;
    }, '설문 집계 기간은 양끝 포함 1~31일입니다.');
// AM05 — 익명이라 사용자·제출 식별자가 없다. 원문은 가공하지 않으므로 화면은 텍스트로만 표시한다
export const surveyFreeTextAnswerSchema = z.object({
    answerText: z.string(),
    submittedAt: z.string(),
});
export type MissionWrite = z.infer<typeof missionWriteSchema>;
export type AdminMission = z.infer<typeof adminMissionSchema>;
export type SurveyFreeTextAnswer = z.infer<typeof surveyFreeTextAnswerSchema>;
