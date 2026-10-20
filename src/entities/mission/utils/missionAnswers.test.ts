import { describe, expect, it } from 'vitest';

import type { MissionQuestion } from '../model/types';

import { buildMissionAnswers, findMissingRequired } from './missionAnswers';

const choiceQuestion: MissionQuestion = {
    id: 'q-choice',
    questionType: 'SINGLE_CHOICE',
    questionText: '선택 문항',
    required: true,
    displayOrder: 2,
    options: [
        { id: 'opt-a', optionText: 'A', displayOrder: 1 },
        { id: 'opt-b', optionText: 'B', displayOrder: 2 },
    ],
};

const textQuestion: MissionQuestion = {
    id: 'q-text',
    questionType: 'FREE_TEXT',
    questionText: '서술 문항',
    required: false,
    displayOrder: 1,
    options: [],
};

const requiredTextQuestion: MissionQuestion = {
    id: 'q-text-required',
    questionType: 'SHORT_ANSWER',
    questionText: '필수 단답 문항',
    required: true,
    displayOrder: 3,
    options: [],
};

describe('buildMissionAnswers', () => {
    it('답이 있는 문항만 displayOrder 순으로 반환한다', () => {
        const answers = buildMissionAnswers([choiceQuestion, textQuestion, requiredTextQuestion], {
            'q-text-required': { answerText: '무너' },
            'q-choice': { selectedOptionId: 'opt-a' },
        });
        expect(answers).toEqual([
            { questionId: 'q-choice', selectedOptionId: 'opt-a' },
            { questionId: 'q-text-required', answerText: '무너' },
        ]);
    });

    it('선택형 문항에는 answerText를 싣지 않는다', () => {
        const answers = buildMissionAnswers([choiceQuestion], {
            'q-choice': { selectedOptionId: 'opt-b', answerText: '남은 값' },
        });
        expect(answers).toEqual([{ questionId: 'q-choice', selectedOptionId: 'opt-b' }]);
    });

    it('서술형 문항에는 selectedOptionId를 싣지 않는다', () => {
        const answers = buildMissionAnswers([requiredTextQuestion], {
            'q-text-required': { answerText: '답', selectedOptionId: 'opt-x' },
        });
        expect(answers).toEqual([{ questionId: 'q-text-required', answerText: '답' }]);
    });

    it('공백만 있는 서술 답변은 제출 목록에서 제외한다', () => {
        const answers = buildMissionAnswers([textQuestion], {
            'q-text': { answerText: '   ' },
        });
        expect(answers).toEqual([]);
    });
});

describe('findMissingRequired', () => {
    it('필수 문항 중 답이 없는 것만 돌려준다', () => {
        const missing = findMissingRequired([choiceQuestion, textQuestion, requiredTextQuestion], {
            'q-choice': { selectedOptionId: 'opt-a' },
        });
        expect(missing.map((q) => q.id)).toEqual(['q-text-required']);
    });

    it('필수 서술 문항에 공백만 있으면 누락으로 본다', () => {
        const missing = findMissingRequired([requiredTextQuestion], {
            'q-text-required': { answerText: '  ' },
        });
        expect(missing).toHaveLength(1);
    });

    it('모든 필수 문항에 답하면 빈 배열이다', () => {
        const missing = findMissingRequired([choiceQuestion, requiredTextQuestion], {
            'q-choice': { selectedOptionId: 'opt-a' },
            'q-text-required': { answerText: '답' },
        });
        expect(missing).toEqual([]);
    });
});
