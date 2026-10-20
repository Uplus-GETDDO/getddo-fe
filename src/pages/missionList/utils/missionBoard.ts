import type { MissionSummary } from '@entities/mission';

import { kstDayDiff } from '@shared/utils/date';

/** 미션 운영 단계 — 운영 기간 [startsAt, endsAt) 기준 */
export type MissionPhase = 'upcoming' | 'open' | 'ended';

export const getMissionPhase = (
    mission: Pick<MissionSummary, 'startsAt' | 'endsAt'>,
    now: Date,
): MissionPhase => {
    if (now < new Date(mission.startsAt)) return 'upcoming';
    if (now >= new Date(mission.endsAt)) return 'ended';
    return 'open';
};

/**
 * 마감까지 남은 날 표시 — 한국 날짜 기준으로 마감일이 오늘이면 '오늘 마감', 아니면 'D-n'.
 * 이미 끝난 미션은 '종료'
 */
export const missionDeadlineLabel = (endsAt: string, now: Date) => {
    const end = new Date(endsAt);
    if (now >= end) return '종료';
    // 마감 시각(endsAt)은 배타적 경계라 1ms 앞을 마감일로 본다 — 자정 마감이 하루 밀리지 않게
    const days = kstDayDiff(new Date(end.getTime() - 1).toISOString(), now);
    return days <= 0 ? '오늘 마감' : `D-${days}`;
};

/** 설문·퀴즈 종류 칩 글자 — 카드와 풀이 모달 머리가 같이 쓴다 */
export const MISSION_KIND_LABEL = { QUIZ: '퀴즈', SURVEY: '설문' } as const;

/** 마감 칩을 보여 주는 남은 날 — 이보다 많이 남으면 급한 정보가 아니라 칩을 숨긴다 */
export const URGENT_DEADLINE_DAYS = 7;

/** 카드·모달 머리의 마감 칩 — 오늘 마감과 D-1~D-7만 돌려주고, 그보다 멀거나 끝났으면 null */
export const missionUrgentDeadline = (endsAt: string, now: Date): string | null => {
    const label = missionDeadlineLabel(endsAt, now);
    if (label === '오늘 마감') return label;
    if (label === '종료') return null;
    return Number(label.slice(2)) <= URGENT_DEADLINE_DAYS ? label : null;
};

/** 설문·퀴즈 목록 거르기 */
export type MissionFilter = 'ALL' | 'QUIZ' | 'SURVEY' | 'DONE';

export const MISSION_FILTERS: { value: MissionFilter; label: string }[] = [
    { value: 'ALL', label: '전체' },
    { value: 'QUIZ', label: '퀴즈' },
    { value: 'SURVEY', label: '설문' },
    { value: 'DONE', label: '참여 완료' },
];

export const filterMissions = (missions: MissionSummary[], filter: MissionFilter) => {
    if (filter === 'ALL') return missions;
    if (filter === 'DONE') return missions.filter((mission) => mission.completed);
    return missions.filter((mission) => mission.missionType === filter);
};

/**
 * 목록 순서 — 지금 참여할 수 있는 미션(마감 빠른 순) → 시작 전 → 참여 완료 → 종료.
 * 같은 묶음 안에서는 받은 순서를 지킨다
 */
export const sortMissions = (missions: MissionSummary[], now: Date) => {
    const rank = (mission: MissionSummary) => {
        if (mission.completed) return 2;
        const phase = getMissionPhase(mission, now);
        return phase === 'open' ? 0 : phase === 'upcoming' ? 1 : 3;
    };
    return missions
        .map((mission, index) => ({ mission, index, rank: rank(mission) }))
        .sort((a, b) => {
            if (a.rank !== b.rank) return a.rank - b.rank;
            if (a.rank === 0) {
                const byEnd =
                    new Date(a.mission.endsAt).getTime() - new Date(b.mission.endsAt).getTime();
                if (byEnd !== 0) return byEnd;
            }
            return a.index - b.index;
        })
        .map(({ mission }) => mission);
};

/** 카드 문항 요약 — "3문항", 선택 문항이 섞여 있으면 "3문항 · 필수 2개" */
export function missionQuestionSummary(questions: { required: boolean }[]): string {
    const required = questions.filter((question) => question.required).length;
    return required > 0 && required < questions.length
        ? `${questions.length}문항 · 필수 ${required}개`
        : `${questions.length}문항`;
}
