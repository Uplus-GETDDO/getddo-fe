import type { MissionWrite } from '@entities/mission';

import { missionWriteSchema } from '@entities/mission';
import { kstInputToUtcIso } from '@shared/utils/date';

export interface MissionFormValues {
    title: string;
    description: string;
    missionType: 'QUIZ' | 'SURVEY';
    startsAt: string;
    endsAt: string;
    questions: {
        questionType: 'OX' | 'SINGLE_CHOICE' | 'SHORT_ANSWER' | 'FREE_TEXT';
        questionText: string;
        required: boolean;
        optionsText: string;
        correctOption: number;
        correctAnswer: string;
    }[];
}
export function missionFormBody(values: MissionFormValues): MissionWrite {
    const quiz = values.missionType === 'QUIZ';
    return missionWriteSchema.parse({
        title: values.title,
        description: values.description,
        missionType: values.missionType,
        startsAt: kstInputToUtcIso(values.startsAt),
        endsAt: kstInputToUtcIso(values.endsAt),
        rewardTicketCount: 1,
        questions: values.questions.map((q, index) => ({
            questionType: q.questionType,
            questionText: q.questionText,
            displayOrder: index + 1,
            ...(!quiz ? { required: q.required } : {}),
            ...(['OX', 'SINGLE_CHOICE'].includes(q.questionType)
                ? {
                      options: q.optionsText
                          .split('\n')
                          .map((text) => text.trim())
                          .filter(Boolean)
                          .map((optionText, i) => ({
                              optionText,
                              displayOrder: i + 1,
                              ...(quiz ? { isCorrect: i + 1 === Number(q.correctOption) } : {}),
                          })),
                  }
                : quiz
                  ? { correctAnswer: q.correctAnswer }
                  : {}),
        })),
    });
}
