import { describe, expect, it } from 'vitest';

import { ticketDayRange, ticketMonthRange } from './historyPeriod';

describe('응모권 합계 기간', () => {
    it('UTC 월말 오후 3시부터 다음 KST 월의 전체 범위를 조회한다', () => {
        expect(ticketMonthRange(new Date('2026-09-30T15:00:00Z'))).toEqual({
            from: '2026-09-30T15:00:00.000Z',
            to: '2026-10-31T15:00:00.000Z',
        });
    });

    it('같은 KST 날짜의 렌더에서는 같은 오늘 범위를 반환한다', () => {
        const expected = {
            from: '2026-10-18T15:00:00.000Z',
            to: '2026-10-19T15:00:00.000Z',
        };
        expect(ticketDayRange(new Date('2026-10-18T15:00:00Z'))).toEqual(expected);
        expect(ticketDayRange(new Date('2026-10-19T14:59:59Z'))).toEqual(expected);
    });
});
