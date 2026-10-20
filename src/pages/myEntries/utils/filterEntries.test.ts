import type { MyEntryRow } from '@widgets/myEntryRows';

import { filterEntryRows, readEntryFilters, scopeEntryRows } from './filterEntries';

const row = (id: string, requestedAt: string, overrides: Partial<MyEntryRow> = {}): MyEntryRow =>
    ({
        entry: { id, requestedAt, status: 'ACCEPTED' },
        event: undefined,
        isTimeRaffle: true,
        result: 'PENDING',
        to: `/time-raffle/${id}`,
        ...overrides,
    }) as MyEntryRow;

const now = new Date('2026-10-13T00:00:00Z');
// 들어오는 목록은 최신 응모순이다 (useMyEntryRows)
const rows = [
    row('a', '2026-10-12T00:00:00Z'),
    row('b', '2026-09-20T00:00:00Z', { result: 'WON', isTimeRaffle: false }),
    row('c', '2026-06-01T00:00:00Z', { result: 'LOST' }),
];

describe('readEntryFilters', () => {
    it('모르는 값은 기본값으로 읽는다', () => {
        expect(readEntryFilters(new URLSearchParams('status=WON&kind=foo'))).toEqual({
            status: 'WON',
            kind: 'ALL',
            period: '3M',
            sort: 'NEWEST',
        });
    });
});

describe('scopeEntryRows', () => {
    it('기간과 종류로 거른다', () => {
        expect(scopeEntryRows(rows, 'ALL', '3M', now).map((r) => r.entry.id)).toEqual(['a', 'b']);
        expect(scopeEntryRows(rows, 'EVENT', 'ALL', now).map((r) => r.entry.id)).toEqual(['b']);
        expect(scopeEntryRows(rows, 'RAFFLE', 'ALL', now).map((r) => r.entry.id)).toEqual([
            'a',
            'c',
        ]);
    });
});

describe('filterEntryRows', () => {
    it('결과로 거르고 오래된 순으로 뒤집는다', () => {
        expect(filterEntryRows(rows, 'WON', 'NEWEST').map((r) => r.entry.id)).toEqual(['b']);
        expect(filterEntryRows(rows, 'ALL', 'OLDEST').map((r) => r.entry.id)).toEqual([
            'c',
            'b',
            'a',
        ]);
    });
});
