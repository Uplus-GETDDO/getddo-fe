import { describe, expect, it } from 'vitest';

import type { ColorWordRound } from './colorWord';
import type { TakkoTimingRound } from './takkoTiming';

import { createColorWordRound } from './colorWord';
import { createXorshift32, ActiveClock, snapshotSubmission } from './gameSession';
import { createTakkoOrder } from './takkoOrder';
import { createTakkoTimingRound, judgeTakkoTiming, takkoTimingPosition } from './takkoTiming';

describe('서버 seed와 원본 입력', () => {
    it('색깔 공통 seed의 첫 네 문제를 재현한다', () => {
        const random = createXorshift32(123456789);
        let previous: ColorWordRound | undefined;
        const rounds = Array.from({ length: 4 }, () => {
            previous = createColorWordRound(random, previous);
            return previous;
        });
        expect(rounds).toEqual([
            { word: 'yellow', ink: 'red' },
            { word: 'green', ink: 'yellow' },
            { word: 'yellow', ink: 'yellow' },
            { word: 'green', ink: 'green' },
        ]);
    });
    it('주문 seed1의 성공 네 판과 실패 세 판을 재현한다', () => {
        const random = createXorshift32(1);
        expect(
            [3, 4, 5, 6, 7, 7, 7].map((length) => createTakkoOrder(length, random).join(',')),
        ).toEqual([
            'scallion,scallion,shrimp',
            'scallion,shrimp,scallion,scallion',
            'scallion,cheese,shrimp,shrimp,cheese',
            'shrimp,scallion,scallion,nori,scallion,nori',
            'scallion,nori,shrimp,nori,cheese,nori,scallion',
            'cheese,shrimp,scallion,scallion,shrimp,scallion,nori',
            'scallion,shrimp,cheese,scallion,nori,cheese,scallion',
        ]);
    });
    it.each([
        [0, 'miss'],
        [304, 'perfect'],
        [427, 'hit'],
    ])('타이밍 seed1의 %i ms는 %s이다', (ms, result) => {
        const round = createTakkoTimingRound(createXorshift32(1), 0);
        expect(judgeTakkoTiming(takkoTimingPosition(Number(ms), round.sweepMs), round)).toBe(
            result,
        );
    });
    it.each([
        [192, 'hit'],
        [832, 'hit'],
        [191, 'miss'],
        [833, 'miss'],
        [416, 'perfect'],
        [608, 'perfect'],
        [415, 'hit'],
        [609, 'hit'],
    ])('타이밍 포함 경계 %i ms', (ms, result) => {
        expect(
            judgeTakkoTiming(takkoTimingPosition(Number(ms), 1024), {
                center: 0.5,
                width: 0.625,
                sweepMs: 1024,
            }),
        ).toBe(result);
    });
    it('정지·카운트다운을 제외하고 누른 순간 정수 ms를 사용한다', () => {
        const clock = new ActiveClock();
        clock.resume(100);
        expect(clock.read(111.9)).toBe(11);
        clock.pause(112.9);
        clock.resume(1000);
        expect(clock.read(1004.8)).toBe(17);
    });
    it('제출 후 원본 입력을 바꿔도 재시도 본문은 그대로다', () => {
        const input = { taps: [{ sequence: 1, elapsedMs: 0 }] };
        const snapshot = snapshotSubmission('token', input);
        input.taps[0]!.elapsedMs = 3;
        expect(snapshot).toEqual({
            playToken: 'token',
            validationData: { taps: [{ sequence: 1, elapsedMs: 0 }] },
        });
    });
    it.each([
        [[0], 0],
        [[304, 1240, 0], 40],
        [[304, 1240, 954, 0], 50],
        [[304, 1240, 850, 0], 60],
        [[2896, 1840, 954, 0], 50],
    ])('타이밍 seed1 점수 경계를 검증한다', (times, expected) => {
        const random = createXorshift32(1);
        let previous: TakkoTimingRound | undefined;
        let successes = 0;
        let score = 0;
        for (const ms of times) {
            const round = createTakkoTimingRound(random, successes, previous);
            previous = round;
            const result = judgeTakkoTiming(takkoTimingPosition(ms, round.sweepMs), round);
            if (result === 'miss') break;
            score += result === 'perfect' ? 20 : 10;
            successes++;
        }
        expect(score).toBe(expected);
    });
    it('본문 1MiB 초과는 원본을 줄이지 않고 제출을 거절한다', () => {
        expect(() =>
            snapshotSubmission('x'.repeat(1048576), { taps: [{ sequence: 1, elapsedMs: 0 }] }),
        ).toThrow('1MiB');
    });
});
