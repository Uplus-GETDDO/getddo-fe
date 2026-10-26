import {
    createTakkoTimingRound,
    judgeTakkoTiming,
    takkoTimingPoints,
    takkoTimingMissDirection,
    takkoTimingPosition,
    takkoTimingSpeedNotice,
    takkoTimingSweepMs,
    takkoTimingZoneWidth,
} from './takkoTiming';

describe('takkoTiming', () => {
    it('성공할수록 빨라지고 금색 구간이 좁아지되 한계 아래로는 내려가지 않는다', () => {
        expect(takkoTimingSweepMs(0)).toBe(1600);
        expect(takkoTimingSweepMs(5)).toBe(1300);
        expect(takkoTimingSweepMs(100)).toBe(650);
        expect(takkoTimingZoneWidth(0)).toBeCloseTo(0.22);
        expect(takkoTimingZoneWidth(5)).toBeCloseTo(0.17);
        expect(takkoTimingZoneWidth(100)).toBeCloseTo(0.09);
    });

    it('타코야끼는 0에서 1까지 갔다가 되돌아온다', () => {
        expect(takkoTimingPosition(0, 1000)).toBe(0);
        expect(takkoTimingPosition(500, 1000)).toBeCloseTo(0.5);
        expect(takkoTimingPosition(1000, 1000)).toBe(1);
        expect(takkoTimingPosition(1500, 1000)).toBeCloseTo(0.5);
        expect(takkoTimingPosition(2000, 1000)).toBe(0);
    });

    it('금색 구간 가운데는 퍼펙트, 구간 안은 성공, 밖은 실패로 채점한다', () => {
        const round = { center: 0.5, width: 0.2, sweepMs: 1000 };
        expect(judgeTakkoTiming(0.51, round)).toBe('perfect');
        expect(judgeTakkoTiming(0.58, round)).toBe('hit');
        expect(judgeTakkoTiming(0.6, round)).toBe('hit');
        expect(judgeTakkoTiming(0.65, round)).toBe('miss');
        expect(takkoTimingPoints('perfect')).toBe(20);
        expect(takkoTimingPoints('hit')).toBe(10);
        expect(takkoTimingPoints('miss')).toBe(0);
    });

    it('금색 구간은 길 양 끝에 붙지 않고, 앞 판과 겹치면 반대편으로 옮긴다', () => {
        const low = createTakkoTimingRound(() => 0, 0);
        const high = createTakkoTimingRound(() => 1, 0);
        expect(low.center - low.width / 2).toBeGreaterThanOrEqual(0.08 - 1e-9);
        expect(high.center + high.width / 2).toBeLessThanOrEqual(0.92 + 1e-9);

        const again = createTakkoTimingRound(() => 0, 0, low);
        expect(Math.abs(again.center - low.center)).toBeGreaterThanOrEqual(low.width);
    });

    it('빗나간 꽂기가 이른지 늦은지 움직이던 방향으로 가린다', () => {
        const round = { center: 0.5, width: 0.2, sweepMs: 1000 };
        // 오른쪽으로 가는 중(0~1000ms) — 구간 앞(0.2)은 이르고 지나친 자리(0.8)는 늦다
        expect(takkoTimingMissDirection(200, round)).toBe('early');
        expect(takkoTimingMissDirection(800, round)).toBe('late');
        // 왼쪽으로 돌아오는 중(1000~2000ms) — 0.8 자리는 아직 닿기 전, 0.2 자리는 지나친 뒤
        expect(takkoTimingMissDirection(1200, round)).toBe('early');
        expect(takkoTimingMissDirection(1800, round)).toBe('late');
    });

    it('세 번째 성공마다 속도 UP, 최고 속도에 처음 닿으면 한 번만 알린다', () => {
        expect(takkoTimingSpeedNotice(1)).toBeNull();
        expect(takkoTimingSpeedNotice(3)).toBe('속도 UP!');
        expect(takkoTimingSpeedNotice(6)).toBe('속도 UP!');
        // 1600 - n×60이 650에 처음 닿는 판 (n=16)
        expect(takkoTimingSpeedNotice(16)).toBe('최고 속도!');
        expect(takkoTimingSpeedNotice(18)).toBeNull();
    });
});
