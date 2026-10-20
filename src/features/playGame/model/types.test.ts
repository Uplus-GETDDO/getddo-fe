import { describe, expect, it } from 'vitest';

import { playResultSchema, validationDataSchema } from './types';
const playId = '0199f000-0000-7000-8000-000000000104';
describe('게임 판정과 입력 경계', () => {
    it.each(['PROCESSING', 'INVALID'])('%s를 유효 점수·보상으로 바꾸지 않는다', (status) => {
        expect(
            playResultSchema.safeParse({
                playId,
                status,
                score: 50,
                completedAt: null,
                reward: null,
            }).success,
        ).toBe(false);
        expect(
            playResultSchema.safeParse({
                playId,
                status,
                score: null,
                completedAt: null,
                reward: null,
            }).success,
        ).toBe(true);
    });
    it('유효한 0점과 보상 없음은 실패가 아니다', () => {
        expect(
            playResultSchema.safeParse({
                playId,
                status: 'VALID',
                score: 0,
                completedAt: '2026-10-20T01:00:00Z',
                reward: null,
            }).success,
        ).toBe(true);
    });
    it('서로 다른 게임 입력을 섞거나 10000개를 초과하면 제출하지 않는다', () => {
        expect(validationDataSchema.safeParse({ answers: [], taps: [] }).success).toBe(false);
        expect(
            validationDataSchema.safeParse({
                taps: Array.from({ length: 10001 }, (_, i) => ({ sequence: i + 1, elapsedMs: 0 })),
            }).success,
        ).toBe(false);
    });
});
