import { describe, expect, it } from 'vitest';

import { FixedRun } from './gameSession';
import { scoreOf } from './takkoRun';

describe('타꼬런 고정 tick', () => {
    it('프레임 분할이 달라도 동일 입력의 종료 tick과 점수가 같다', () => {
        const run = (dt: number) => {
            const session = new FixedRun(1, 72000);
            session.input('press');
            while (session.run.phase !== 'over') session.advance(dt);
            return {
                endTick: session.endTick,
                score: scoreOf(session.run),
                inputs: session.inputs,
            };
        };
        expect(run(1 / 30)).toEqual(run(1 / 144));
    });
    it.each([
        [1, 348, 122],
        [123456789, 347, 121],
    ])('Java 고정 예제 seed %i', (seed, endTick, score) => {
        const session = new FixedRun(seed, 72000);
        session.input('press');
        while (session.run.phase !== 'over') session.advance(1 / 120);
        expect({ endTick: session.endTick, score: scoreOf(session.run) }).toEqual({
            endTick,
            score,
        });
    });
    it('정지 시간에는 tick을 늘리지 않고 release를 다음 활성 tick에 남긴다', () => {
        const session = new FixedRun(1, 72000);
        session.input('press');
        session.advance(1 / 120);
        session.run.phase = 'paused';
        session.input('release');
        session.advance(5);
        expect(session.endTick).toBe(0);
        session.run.phase = 'running';
        session.advance(1 / 120);
        expect(session.inputs).toEqual([
            { tick: 0, type: 'press' },
            { tick: 1, type: 'release' },
        ]);
    });
    it('활성 시간 상한의 마지막 번호는 maxTicks-1이다', () => {
        const session = new FixedRun(1, 2);
        session.input('press');
        session.advance(1);
        expect(session.endTick).toBe(1);
        expect(session.run.phase).toBe('over');
    });
    it('충돌 없는 고정 세계에서 72000 tick 뒤 endTick 71999로 종료한다', () => {
        const session = new FixedRun(1, 72000);
        session.run.nextObstacleAt = Infinity;
        session.input('press');
        for (let tick = 0; tick < 72000; tick++) session.advance(1 / 120);
        expect(session.endTick).toBe(71999);
        expect(session.run.phase).toBe('over');
    });
    it('입력 10000개를 넘기면 정상 종료로 바꾸지 않는다', () => {
        const session = new FixedRun(1, 72000);
        for (let i = 0; i < 10000; i++) session.input(i % 2 === 0 ? 'press' : 'release');
        expect(() => session.input('press')).toThrow('입력 한도');
        expect(session.run.phase).toBe('running');
        expect(session.endTick).toBe(-1);
    });
});
