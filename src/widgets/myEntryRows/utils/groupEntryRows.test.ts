import type { MyResultStatus } from '@entities/drawResult';
import type { EntryStatus, TicketsByGrade } from '@entities/entry';

import type { MyEntryRow } from '../hooks/useMyEntryRows';

import { groupEntryRows } from './groupEntryRows';

const grades = (bronze = 0, silver = 0, gold = 0, platinum = 0): TicketsByGrade => ({
    BRONZE: bronze,
    SILVER: silver,
    GOLD: gold,
    PLATINUM: platinum,
});

const row = (
    id: string,
    eventId: string,
    requestedAt: string,
    overrides: {
        status?: EntryStatus;
        result?: MyResultStatus;
        deducted?: TicketsByGrade;
        isTimeRaffle?: boolean;
    } = {},
): MyEntryRow => {
    const status = overrides.status ?? 'ACCEPTED';
    const deducted = overrides.deducted ?? grades(1);
    return {
        entry: {
            id,
            eventId,
            eventTitle: `이벤트 ${eventId}`,
            status,
            requestedAt,
            deductedTicketCount: Object.values(deducted).reduce((a, b) => a + b, 0),
            deductedTicketsByGrade: deducted,
            rejectionCode: status === 'REJECTED' ? 'ENTRY-005' : null,
            rejectionReason: status === 'REJECTED' ? '응모 마감' : null,
        },
        event: undefined,
        isTimeRaffle: overrides.isTimeRaffle ?? true,
        result: status === 'ACCEPTED' ? overrides.result : undefined,
        to: `/time-raffle/${eventId}`,
    } as MyEntryRow;
};

describe('groupEntryRows', () => {
    it('같은 이벤트의 접수 응모를 한 줄로 묶고 장수·횟수를 합산한다', () => {
        // GD-281 회귀: 3번 응모·1번 당첨 이벤트가 당첨 3건으로 세어지던 것
        const rows = [
            row('e3', 'evt-a', '2026-10-12T00:00:00Z', {
                result: 'WON',
                deducted: grades(2, 1),
            }),
            row('e2', 'evt-a', '2026-10-11T00:00:00Z', {
                result: 'WON',
                deducted: grades(1),
            }),
            row('e1', 'evt-a', '2026-10-10T00:00:00Z', {
                result: 'WON',
                deducted: grades(0, 0, 1),
            }),
            row('e4', 'evt-b', '2026-10-09T00:00:00Z', { result: 'LOST' }),
        ];
        const groups = groupEntryRows(rows);
        expect(groups).toHaveLength(2);
        const [a] = groups;
        expect(a).toMatchObject({
            key: 'event:evt-a',
            status: 'ACCEPTED',
            result: 'WON',
            entryCount: 3,
            usedTicketCount: 5,
            usedTicketsByGrade: grades(3, 1, 1),
            latestRequestedAt: '2026-10-12T00:00:00Z',
        });
        expect(groups.filter((g) => g.result === 'WON')).toHaveLength(1);
    });

    it('거절 응모는 묶지 않고 사유를 보존한 개별 줄로 남긴다', () => {
        // useMyEntryRows가 넘기는 순서(최신 응모순)와 같게 넣는다
        const rows = [
            row('e2', 'evt-a', '2026-10-13T00:00:00Z', { status: 'REJECTED' }),
            row('e1', 'evt-a', '2026-10-12T00:00:00Z', { result: 'PENDING' }),
            row('e3', 'evt-a', '2026-10-11T00:00:00Z', { status: 'REJECTED' }),
        ];
        const groups = groupEntryRows(rows);
        expect(groups.map((g) => g.key)).toEqual(['entry:e2', 'event:evt-a', 'entry:e3']);
        const rejected = groups.filter((g) => g.status === 'REJECTED');
        expect(rejected).toHaveLength(2);
        expect(rejected[0]).toMatchObject({
            rejectionCode: 'ENTRY-005',
            rejectionReason: '응모 마감',
            entryCount: 1,
            result: undefined,
        });
        expect(groups.find((g) => g.status === 'ACCEPTED')?.entryCount).toBe(1);
    });

    it('응모권을 쓰지 않은 참여도 그룹에 포함해 횟수를 센다', () => {
        const rows = [
            row('e1', 'evt-a', '2026-10-12T00:00:00Z', { deducted: grades(1) }),
            row('e2', 'evt-a', '2026-10-11T00:00:00Z', { deducted: grades() }),
        ];
        const [group] = groupEntryRows(rows);
        expect(group?.entryCount).toBe(2);
        expect(group?.usedTicketCount).toBe(1);
    });
});
