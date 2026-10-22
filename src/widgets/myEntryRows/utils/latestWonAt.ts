import type { MyEntryGroup } from './groupEntryRows';

/**
 * 당첨 줄 중 가장 최근 마감 시각 — 계약에 발표 시각이 없어(ADR-022) 마감 시각을 '최근 당첨' 근사로 쓴다.
 * 이벤트 정보가 없으면 최근 응모 시각으로 대신한다
 */
export function latestWonAt(groups: readonly MyEntryGroup[]): string | undefined {
    return groups
        .filter((group) => group.result === 'WON')
        .map((group) => group.event?.endsAt ?? group.latestRequestedAt)
        .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0];
}
