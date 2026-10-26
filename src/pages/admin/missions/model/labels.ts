import type { AdminMission } from '@entities/mission';

export const MISSION_TYPE_LABEL: Record<AdminMission['missionType'], string> = {
    SURVEY: '설문',
    QUIZ: '퀴즈',
};

// 문항 유형 — 등록 폼(MissionFormDialog)의 선택지 이름과 같게 읽힌다
export const QUESTION_TYPE_LABEL: Record<
    AdminMission['questions'][number]['questionType'],
    string
> = {
    OX: 'OX',
    SINGLE_CHOICE: '단일 선택',
    SHORT_ANSWER: '단답',
    FREE_TEXT: '자유 서술',
};
