import type { MyEntryRow } from '../hooks/useMyEntryRows';

import { latestWonAt } from './latestWonAt';

const row = (requestedAt: string, endsAt: string | null, result: MyEntryRow['result']) =>
    ({
        entry: { requestedAt },
        event: endsAt ? { endsAt } : undefined,
        result,
    }) as MyEntryRow;

describe('latestWonAt', () => {
    it('응모순이 아니라 마감 시각이 가장 늦은 당첨을 고른다', () => {
        // 최신 응모순 — 첫 당첨(10.10 응모)보다 먼저 응모한 당첨(10.01 응모)이 더 늦게 마감됐다
        const rows = [
            row('2026-10-12T00:00:00Z', '2026-10-12T01:00:00Z', 'LOST'),
            row('2026-10-10T00:00:00Z', '2026-10-10T01:00:00Z', 'WON'),
            row('2026-10-01T00:00:00Z', '2026-10-11T00:00:00Z', 'WON'),
        ];
        expect(latestWonAt(rows)).toBe('2026-10-11T00:00:00Z');
    });

    it('당첨이 없으면 undefined, 이벤트 정보가 없으면 응모 시각을 쓴다', () => {
        expect(latestWonAt([row('2026-10-01T00:00:00Z', null, 'LOST')])).toBeUndefined();
        expect(latestWonAt([row('2026-10-01T00:00:00Z', null, 'WON')])).toBe(
            '2026-10-01T00:00:00Z',
        );
    });
});
