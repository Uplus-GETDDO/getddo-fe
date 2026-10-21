import type { MyEntryGroup } from '@widgets/myEntryRows';

import { filterEntryRows, readEntryFilters, scopeEntryRows } from './filterEntries';

const group = (
    id: string,
    latestRequestedAt: string,
    overrides: Partial<MyEntryGroup> = {},
): MyEntryGroup =>
    ({
        key: `event:${id}`,
        eventId: id,
        status: 'ACCEPTED',
        latestRequestedAt,
        event: undefined,
        isTimeRaffle: true,
        result: 'PENDING',
        to: `/time-raffle/${id}`,
        ...overrides,
    }) as MyEntryGroup;

const now = new Date('2026-10-13T00:00:00Z');
// 들어오는 목록은 최신 응모순이다 (useMyEntryRows)
const groups = [
    group('a', '2026-10-12T00:00:00Z'),
    group('b', '2026-09-20T00:00:00Z', { result: 'WON', isTimeRaffle: false }),
    group('c', '2026-06-01T00:00:00Z', { result: 'LOST' }),
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
        expect(scopeEntryRows(groups, 'ALL', '3M', now).map((g) => g.eventId)).toEqual(['a', 'b']);
        expect(scopeEntryRows(groups, 'EVENT', 'ALL', now).map((g) => g.eventId)).toEqual(['b']);
        expect(scopeEntryRows(groups, 'RAFFLE', 'ALL', now).map((g) => g.eventId)).toEqual([
            'a',
            'c',
        ]);
    });
});

describe('filterEntryRows', () => {
    it('결과로 거르고 오래된 순으로 뒤집는다', () => {
        expect(filterEntryRows(groups, 'WON', 'NEWEST').map((g) => g.eventId)).toEqual(['b']);
        expect(filterEntryRows(groups, 'ALL', 'OLDEST').map((g) => g.eventId)).toEqual([
            'c',
            'b',
            'a',
        ]);
    });
});
