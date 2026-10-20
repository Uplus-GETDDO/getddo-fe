import type { MyEntryRow } from '../hooks/useMyEntryRows';

/**
 * 당첨 줄 중 가장 최근 마감 시각 — 계약에 발표 시각이 없어(ADR-022) 마감 시각을 '최근 당첨' 근사로 쓴다.
 * 이벤트 정보가 없으면 응모 시각으로 대신한다
 */
export function latestWonAt(rows: readonly MyEntryRow[]): string | undefined {
    return rows
        .filter((row) => row.result === 'WON')
        .map((row) => row.event?.endsAt ?? row.entry.requestedAt)
        .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0];
}
