import type { MissionAnswer, MissionQuestion } from '../model/types';

/** 폼이 관리하는 문항별 답변 초안 — 선택형은 선택지 id, 서술형은 텍스트를 담는다 */
export interface MissionAnswerDraft {
    selectedOptionId?: string;
    answerText?: string;
}

const CHOICE_TYPES: MissionQuestion['questionType'][] = ['OX', 'SINGLE_CHOICE'];

const isChoice = (question: MissionQuestion) => CHOICE_TYPES.includes(question.questionType);

const hasDraftAnswer = (question: MissionQuestion, draft: MissionAnswerDraft | undefined) =>
    isChoice(question)
        ? draft?.selectedOptionId !== undefined
        : typeof draft?.answerText === 'string' && draft.answerText.trim().length > 0;

/**
 * 폼 초안을 M03 요청 본문의 answers 배열로 변환한다.
 * 선택형은 selectedOptionId만, 서술형은 answerText만 싣는 계약을 지킨다 (mission.md 초안).
 */
export function buildMissionAnswers(
    questions: MissionQuestion[],
    drafts: Record<string, MissionAnswerDraft>,
): MissionAnswer[] {
    return [...questions]
        .sort((a, b) => a.displayOrder - b.displayOrder)
        .flatMap((question): MissionAnswer[] => {
            const draft = drafts[question.id];
            if (isChoice(question)) {
                return draft?.selectedOptionId !== undefined
                    ? [
                          {
                              questionId: question.id,
                              selectedOptionId: draft.selectedOptionId,
                          },
                      ]
                    : [];
            }
            const answerText = draft?.answerText?.trim();
            return answerText ? [{ questionId: question.id, answerText }] : [];
        });
}

/** 필수 문항 중 답이 비어 있는 문항을 돌려준다 — 제출 전 클라이언트 1차 검증용 */
export function findMissingRequired(
    questions: MissionQuestion[],
    drafts: Record<string, MissionAnswerDraft>,
): MissionQuestion[] {
    return questions.filter(
        (question) => question.required && !hasDraftAnswer(question, drafts[question.id]),
    );
}
