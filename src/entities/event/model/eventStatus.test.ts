import { describe, expect, it } from 'vitest';

import type { AdminEventStatus } from './adminTypes';

import { isFinalEventStatus } from './eventStatus';

describe('isFinalEventStatus', () => {
    it.each<AdminEventStatus>(['PUBLISHED', 'NO_ENTRANTS', 'NO_ELIGIBLE_ENTRANTS', 'CANCELED'])(
        '%s는 더 전이하지 않는 종결 상태다',
        (status) => {
            expect(isFinalEventStatus(status)).toBe(true);
        },
    );

    it.each<AdminEventStatus>(['SCHEDULED', 'OPEN', 'CLOSED', 'DRAW_CONFIRMED', 'REDRAWING'])(
        '%s는 이후 전이가 남은 상태다',
        (status) => {
            expect(isFinalEventStatus(status)).toBe(false);
        },
    );
});
