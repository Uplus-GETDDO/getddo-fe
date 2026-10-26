import { describe, expect, it } from 'vitest';

import type { MissionSummary } from '@entities/mission';

import {
    filterMissions,
    getMissionPhase,
    missionDeadlineLabel,
    missionQuestionSummary,
    missionUrgentDeadline,
    sortMissions,
} from './missionBoard';

const mission = (overrides: Partial<MissionSummary>): MissionSummary => ({
    id: 'm',
    title: '미션',
    imageUrl: null,
    missionType: 'QUIZ',
    startsAt: '2026-10-01T00:00:00Z',
    endsAt: '2026-12-31T14:59:59Z',
    rewardTicketCount: 1,
    completed: false,
    serverTime: '2026-10-12T00:00:00Z',
    ...overrides,
});

// 2026-10-12 12:00 KST
const NOW = new Date('2026-10-12T03:00:00Z');

describe('getMissionPhase', () => {
    it('운영 기간 [startsAt, endsAt)으로 단계를 나눈다', () => {
        expect(getMissionPhase(mission({ startsAt: '2026-10-13T00:00:00Z' }), NOW)).toBe(
            'upcoming',
        );
        expect(getMissionPhase(mission({}), NOW)).toBe('open');
        expect(getMissionPhase(mission({ endsAt: '2026-10-12T03:00:00Z' }), NOW)).toBe('ended');
    });
});

describe('missionUrgentDeadline', () => {
    it('오늘 마감과 7일 이내만 칩으로 보여 준다', () => {
        expect(missionUrgentDeadline('2026-10-12T14:59:59Z', NOW)).toBe('오늘 마감');
        // 2026-10-19 23:59:59 KST
        expect(missionUrgentDeadline('2026-10-19T14:59:59Z', NOW)).toBe('D-7');
    });

    it('8일 이상 남았거나 끝난 미션은 칩이 없다', () => {
        expect(missionUrgentDeadline('2026-10-20T14:59:59Z', NOW)).toBeNull();
        expect(missionUrgentDeadline('2026-10-01T00:00:00Z', NOW)).toBeNull();
    });
});

describe('missionDeadlineLabel', () => {
    it('한국 날짜로 마감일이 오늘이면 오늘 마감', () => {
        // 2026-10-12 23:59:59 KST
        expect(missionDeadlineLabel('2026-10-12T14:59:59Z', NOW)).toBe('오늘 마감');
    });

    it('남은 날 수를 D-n으로 보여 준다', () => {
        // 2026-10-15 23:59:59 KST
        expect(missionDeadlineLabel('2026-10-15T14:59:59Z', NOW)).toBe('D-3');
    });

    it('자정에 끝나는 미션은 전날을 마감일로 센다', () => {
        // 2026-10-13 00:00 KST — 12일 하루를 다 쓰고 끝난다
        expect(missionDeadlineLabel('2026-10-12T15:00:00Z', NOW)).toBe('오늘 마감');
    });

    it('끝난 미션은 종료', () => {
        expect(missionDeadlineLabel('2026-10-12T02:59:59Z', NOW)).toBe('종료');
    });
});

describe('filterMissions', () => {
    const list = [
        mission({ id: 'q', missionType: 'QUIZ' }),
        mission({ id: 's', missionType: 'SURVEY' }),
        mission({ id: 'd', missionType: 'SURVEY', completed: true }),
    ];

    it('종류·참여 완료로 거른다', () => {
        expect(filterMissions(list, 'ALL').map((m) => m.id)).toEqual(['q', 's', 'd']);
        expect(filterMissions(list, 'QUIZ').map((m) => m.id)).toEqual(['q']);
        expect(filterMissions(list, 'SURVEY').map((m) => m.id)).toEqual(['s', 'd']);
        expect(filterMissions(list, 'DONE').map((m) => m.id)).toEqual(['d']);
    });
});

describe('sortMissions', () => {
    it('참여 가능(마감 빠른 순) → 시작 전 → 참여 완료 → 종료', () => {
        const sorted = sortMissions(
            [
                mission({ id: 'ended', endsAt: '2026-09-30T14:59:59Z' }),
                mission({ id: 'done', completed: true }),
                mission({ id: 'late' }),
                mission({ id: 'upcoming', startsAt: '2026-10-20T00:00:00Z' }),
                mission({ id: 'soon', endsAt: '2026-10-14T14:59:59Z' }),
            ],
            NOW,
        );
        expect(sorted.map((m) => m.id)).toEqual(['soon', 'late', 'upcoming', 'done', 'ended']);
    });
});

describe('missionQuestionSummary', () => {
    it('문항 수, 선택 문항이 섞이면 필수 개수를 붙인다', () => {
        expect(missionQuestionSummary([{ required: true }])).toBe('1문항');
        expect(missionQuestionSummary([{ required: true }, { required: false }])).toBe(
            '2문항 · 필수 1개',
        );
        expect(missionQuestionSummary([{ required: false }, { required: false }])).toBe('2문항');
    });
});
