import { describe, expect, it } from 'vitest';

import { missionWriteSchema, surveyRangeSchema } from './adminTypes';

const base = {
    title: '미션',
    description: '설명',
    missionType: 'QUIZ',
    startsAt: '2026-10-20T00:00:00Z',
    endsAt: '2026-10-21T00:00:00Z',
    rewardTicketCount: 1,
};
const question = {
    questionType: 'SINGLE_CHOICE',
    questionText: '문항',
    displayOrder: 1,
    options: [
        { optionText: '하나', displayOrder: 1, isCorrect: true },
        { optionText: '둘', displayOrder: 2, isCorrect: false },
    ],
};

describe('관리자 미션 계약', () => {
    it('선택형 퀴즈는 정답 하나와 보상 1장을 요구한다', () => {
        expect(missionWriteSchema.safeParse({ ...base, questions: [question] }).success).toBe(true);
        expect(
            missionWriteSchema.safeParse({ ...base, rewardTicketCount: 2, questions: [question] })
                .success,
        ).toBe(false);
        expect(
            missionWriteSchema.safeParse({
                ...base,
                questions: [
                    {
                        ...question,
                        options: question.options.map((o) => ({ ...o, isCorrect: true })),
                    },
                ],
            }).success,
        ).toBe(false);
    });
    it('설문 자유서술에는 정답 없이 필수 여부를 사용한다', () => {
        expect(
            missionWriteSchema.safeParse({
                ...base,
                missionType: 'SURVEY',
                questions: [
                    {
                        questionType: 'FREE_TEXT',
                        questionText: '의견',
                        required: true,
                        displayOrder: 1,
                    },
                ],
            }).success,
        ).toBe(true);
    });
    it('종료가 시작과 같으면 거절한다', () => {
        expect(
            missionWriteSchema.safeParse({ ...base, endsAt: base.startsAt, questions: [question] })
                .success,
        ).toBe(false);
    });
    it('설문 집계는 양끝 포함 최대 31일이다', () => {
        expect(surveyRangeSchema.safeParse({ from: '2026-10-01', to: '2026-10-31' }).success).toBe(
            true,
        );
        expect(surveyRangeSchema.safeParse({ from: '2026-10-01', to: '2026-11-01' }).success).toBe(
            false,
        );
        expect(surveyRangeSchema.safeParse({ from: '2026-02-30', to: '2026-03-01' }).success).toBe(
            false,
        );
    });
});
