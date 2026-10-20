import { describe, expect, it } from 'vitest';

import { dailyPolicyWriteSchema, streakPolicyWriteSchema } from './adminTypes';

describe('출석 예약 입력', () => {
    it('일일 보상은 양의 정수이며 적용일을 입력받지 않는다', () => {
        expect(dailyPolicyWriteSchema.safeParse({ rewardTicketCount: 0 }).success).toBe(false);
        expect(
            dailyPolicyWriteSchema.parse({ rewardTicketCount: 3, effectiveFrom: '과거' }),
        ).toEqual({ rewardTicketCount: 3 });
    });
    it.each([
        [7, 7],
        [14, 7],
        [0, 7],
        [7, 29],
    ])('중복·역순·범위 밖 단계 %j를 거절한다', (...days) => {
        expect(
            streakPolicyWriteSchema.safeParse({
                milestones: days.map((milestoneDays) => ({ milestoneDays, rewardTicketCount: 1 })),
            }).success,
        ).toBe(false);
    });
    it('여러 단계의 수량을 별도로 유지한다', () => {
        const milestones = [
            { milestoneDays: 7, rewardTicketCount: 1 },
            { milestoneDays: 28, rewardTicketCount: 7 },
        ];
        expect(streakPolicyWriteSchema.parse({ milestones }).milestones).toEqual(milestones);
    });
});
