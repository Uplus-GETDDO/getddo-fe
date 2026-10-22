import { describe, expect, it } from 'vitest';

import type { DailyAttendancePolicy, StreakPolicySet } from '@entities/attendance';

import { selectDailyAttendancePolicies, selectStreakPolicySets } from './policySelection';

const NOW = new Date('2026-06-15T12:00:00+09:00');
const MONTH = '2026-06';

const dailyPolicy = (id: string, effectiveFrom: string): DailyAttendancePolicy => ({
    id,
    rewardTicketCount: 2,
    effectiveFrom,
    effectiveUntil: null,
    createdBy: 'admin',
    createdByName: '관리자',
    createdAt: '2026-01-01T00:00:00Z',
});

const streakSet = (id: string, effectiveMonth: string): StreakPolicySet => ({
    id,
    effectiveMonth,
    milestones: [{ id: `${id}-m1`, milestoneDays: 7, rewardTicketCount: 1 }],
    createdBy: 'admin',
    createdByName: '관리자',
    createdAt: '2026-01-01T00:00:00Z',
});

describe('selectDailyAttendancePolicies', () => {
    it('effectiveFrom이 now와 같으면 적용 시작 정각도 이미 시작된 정책이다', () => {
        const policy = dailyPolicy('p1', NOW.toISOString());
        expect(selectDailyAttendancePolicies([policy], NOW)).toEqual({
            current: policy,
            scheduled: null,
        });
    });

    it('effectiveFrom이 now 직후(1ms 뒤)이면 scheduled다', () => {
        const current = dailyPolicy('current', '2026-06-15T11:59:59+09:00');
        const scheduled = dailyPolicy('scheduled', '2026-06-15T12:00:00.001+09:00');
        expect(selectDailyAttendancePolicies([current, scheduled], NOW)).toEqual({
            current,
            scheduled,
        });
    });

    it('빈 배열이면 current·scheduled 모두 null이다', () => {
        expect(selectDailyAttendancePolicies([], NOW)).toEqual({
            current: null,
            scheduled: null,
        });
    });

    it('전부 미래면 current는 null이고 가장 가까운 것이 scheduled다', () => {
        const near = dailyPolicy('near', '2026-06-16T00:00:00+09:00');
        const far = dailyPolicy('far', '2026-07-01T00:00:00+09:00');
        expect(selectDailyAttendancePolicies([far, near], NOW)).toEqual({
            current: null,
            scheduled: near,
        });
    });

    it('미래 행이 여러 건이면 가장 가까운 것만 scheduled다', () => {
        const near = dailyPolicy('near', '2026-06-16T00:00:00+09:00');
        const mid = dailyPolicy('mid', '2026-06-20T00:00:00+09:00');
        const far = dailyPolicy('far', '2026-07-01T00:00:00+09:00');
        const { scheduled } = selectDailyAttendancePolicies([far, mid, near], NOW);
        expect(scheduled).toBe(near);
    });

    it('과거 행이 여러 건이면 가장 최근 것이 current다', () => {
        const older = dailyPolicy('older', '2026-05-01T00:00:00+09:00');
        const newer = dailyPolicy('newer', '2026-06-01T00:00:00+09:00');
        const { current } = selectDailyAttendancePolicies([older, newer], NOW);
        expect(current).toBe(newer);
    });

    it('입력 배열의 순서를 바꿔도 결과가 같고 배열을 변경하지 않는다', () => {
        const a = dailyPolicy('a', '2026-05-01T00:00:00+09:00');
        const b = dailyPolicy('b', '2026-06-01T00:00:00+09:00');
        const c = dailyPolicy('c', '2026-07-01T00:00:00+09:00');
        const shuffled = [c, a, b];
        expect(selectDailyAttendancePolicies(shuffled, NOW)).toEqual(
            selectDailyAttendancePolicies([a, b, c], NOW),
        );
        expect(shuffled).toEqual([c, a, b]);
    });
});

describe('selectStreakPolicySets', () => {
    it('effectiveMonth가 당월이면 이미 시작된 정책이다', () => {
        const set = streakSet('s1', MONTH);
        expect(selectStreakPolicySets([set], MONTH)).toEqual({
            current: set,
            scheduled: null,
        });
    });

    it('effectiveMonth가 다음 달이면 scheduled다 — 연도 넘김도 문자열 비교로 처리한다', () => {
        const current = streakSet('current', '2026-12');
        const scheduled = streakSet('scheduled', '2027-01');
        expect(selectStreakPolicySets([current, scheduled], '2026-12')).toEqual({
            current,
            scheduled,
        });
    });

    it('빈 배열이면 current·scheduled 모두 null이다', () => {
        expect(selectStreakPolicySets([], MONTH)).toEqual({
            current: null,
            scheduled: null,
        });
    });

    it('전부 미래면 current는 null이고 가장 가까운 것이 scheduled다', () => {
        const near = streakSet('near', '2026-08');
        const far = streakSet('far', '2026-10');
        expect(selectStreakPolicySets([far, near], MONTH)).toEqual({
            current: null,
            scheduled: near,
        });
    });

    it('과거 행이 여러 건이면 가장 최근 것이 current다', () => {
        const older = streakSet('older', '2026-03');
        const newer = streakSet('newer', '2026-05');
        const { current } = selectStreakPolicySets([older, newer], MONTH);
        expect(current).toBe(newer);
    });

    it('입력 배열의 순서를 바꿔도 결과가 같고 배열을 변경하지 않는다', () => {
        const a = streakSet('a', '2026-04');
        const b = streakSet('b', '2026-05');
        const c = streakSet('c', '2026-07');
        const shuffled = [c, a, b];
        expect(selectStreakPolicySets(shuffled, MONTH)).toEqual(
            selectStreakPolicySets([a, b, c], MONTH),
        );
        expect(shuffled).toEqual([c, a, b]);
    });
});
