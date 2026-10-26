import { describe, expect, it } from 'vitest';

import { isMissionOpen, isMissionOpenByServerTime } from './missionPeriod';

describe('isMissionOpen', () => {
    it('미션은 운영 기간 [시작, 종료) 안에서만 참여할 수 있다', () => {
        const mission = { startsAt: '2026-10-01T00:00:00Z', endsAt: '2026-10-31T00:00:00Z' };
        expect(isMissionOpen(mission, new Date('2026-09-30T23:59:59Z'))).toBe(false);
        expect(isMissionOpen(mission, new Date('2026-10-01T00:00:00Z'))).toBe(true);
        expect(isMissionOpen(mission, new Date('2026-10-30T23:59:59Z'))).toBe(true);
        expect(isMissionOpen(mission, new Date('2026-10-31T00:00:00Z'))).toBe(false);
    });
});

describe('isMissionOpenByServerTime', () => {
    it('serverTime이 [startsAt, endsAt) 안이면 진행 중이다', () => {
        const mission = {
            startsAt: '2026-10-20T00:00:00+09:00',
            endsAt: '2026-10-25T00:00:00+09:00',
            serverTime: '2026-10-21T12:00:00+09:00',
        };
        expect(isMissionOpenByServerTime(mission)).toBe(true);
    });
    it('serverTime이 종료 정각이면 마감이고 시작 전이면 열리지 않았다', () => {
        expect(
            isMissionOpenByServerTime({
                startsAt: '2026-10-20T00:00:00+09:00',
                endsAt: '2026-10-21T12:00:00+09:00',
                serverTime: '2026-10-21T12:00:00+09:00',
            }),
        ).toBe(false);
        expect(
            isMissionOpenByServerTime({
                startsAt: '2026-10-22T00:00:00+09:00',
                endsAt: '2026-10-25T00:00:00+09:00',
                serverTime: '2026-10-21T12:00:00+09:00',
            }),
        ).toBe(false);
    });
});
