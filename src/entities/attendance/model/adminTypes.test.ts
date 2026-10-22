import { describe, expect, it } from 'vitest';

import {
    dailyAttendancePolicySchema,
    dailyPolicyWriteSchema,
    streakPolicySetSchema,
    streakPolicyWriteSchema,
} from './adminTypes';

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
    it('정책 응답은 작성자 이름이 없거나 null이어도 파싱한다 (ADR-028)', () => {
        const daily = {
            id: 'p-1',
            rewardTicketCount: 2,
            effectiveFrom: '2026-11-01T00:00:00Z',
            effectiveUntil: null,
            createdBy: 'admin',
            createdAt: '2026-10-01T00:00:00Z',
        };
        expect(dailyAttendancePolicySchema.safeParse(daily).success).toBe(true);
        expect(
            dailyAttendancePolicySchema.safeParse({ ...daily, createdByName: '관리자' }).success,
        ).toBe(true);
        const streak = {
            id: 's-1',
            effectiveMonth: '2026-11',
            milestones: [{ id: 'ms-1', milestoneDays: 7, rewardTicketCount: 1 }],
            createdBy: 'admin',
            createdByName: null,
            createdAt: '2026-10-01T00:00:00Z',
        };
        expect(streakPolicySetSchema.safeParse(streak).success).toBe(true);
    });
});
