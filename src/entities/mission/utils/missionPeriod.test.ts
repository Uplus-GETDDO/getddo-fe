import { describe, expect, it } from 'vitest';

import { isMissionOpen } from './missionPeriod';

describe('isMissionOpen', () => {
    it('미션은 운영 기간 [시작, 종료) 안에서만 참여할 수 있다', () => {
        const mission = { startsAt: '2026-10-01T00:00:00Z', endsAt: '2026-10-31T00:00:00Z' };
        expect(isMissionOpen(mission, new Date('2026-09-30T23:59:59Z'))).toBe(false);
        expect(isMissionOpen(mission, new Date('2026-10-01T00:00:00Z'))).toBe(true);
        expect(isMissionOpen(mission, new Date('2026-10-30T23:59:59Z'))).toBe(true);
        expect(isMissionOpen(mission, new Date('2026-10-31T00:00:00Z'))).toBe(false);
    });
});
