import type { AttendanceMilestone } from '@entities/attendance';

import { nextStreakMilestone } from './nextStreakMilestone';

const milestone = (milestoneDays: number, rewardTicketCount: number, claimed = false) =>
    ({ milestoneDays, rewardTicketCount, claimed, claimedAt: null }) satisfies AttendanceMilestone;

const MILESTONES = [milestone(14, 3), milestone(7, 1), milestone(28, 7)];

describe('nextStreakMilestone', () => {
    it('지금 연속 일수보다 큰 가장 가까운 단계를 고른다', () => {
        expect(nextStreakMilestone(MILESTONES, 3, 20)).toEqual({
            milestoneDays: 7,
            remainingDays: 4,
            rewardTicketCount: 1,
        });
    });

    it('이미 받은 단계는 건너뛴다', () => {
        const claimed = [milestone(7, 1, true), milestone(14, 3), milestone(28, 7)];
        expect(nextStreakMilestone(claimed, 2, 20)?.milestoneDays).toBe(14);
    });

    it('이번 달 안에 닿을 수 없으면 없다', () => {
        expect(nextStreakMilestone(MILESTONES, 3, 3)).toBeNull();
    });

    it('남은 단계가 없으면 없다', () => {
        expect(nextStreakMilestone(MILESTONES, 28, 3)).toBeNull();
    });
});
