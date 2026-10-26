import { describe, expect, it } from 'vitest';

import * as game from './types';

describe('게임 조회 계약', () => {
    it('UUID와 code, nullable 설명을 소비하며 임시 횟수 제한을 요구하지 않는다', () => {
        expect(
            game.gameSchema.safeParse({
                id: '0199f000-0000-7000-8000-000000000101',
                code: 'COLOR_WORD',
                name: '색깔',
                description: null,
            }).success,
        ).toBe(true);
    });
    it('누적 통계와 서버의 KST 기준일을 소비한다', () => {
        expect(
            game.gameStatisticsSchema.parse({
                gameId: '0199f000-0000-7000-8000-000000000101',
                bestScore: 50,
                totalScore: 100,
                validPlayCount: 3,
                rewardDate: '2026-10-20',
                rewardClaimedToday: true,
                nextResetAt: '2026-10-20T15:00:00Z',
                serverTime: '2026-10-20T14:59:00Z',
            }).validPlayCount,
        ).toBe(3);
    });
});
