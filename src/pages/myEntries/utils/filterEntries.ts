import type { MyEntryGroup } from '@widgets/myEntryRows';

export type EntryStatusFilter = 'ALL' | 'PENDING' | 'WON' | 'LOST';
export type EntryKindFilter = 'ALL' | 'RAFFLE' | 'EVENT';
export type EntryPeriod = '1M' | '3M' | 'ALL';
export type EntrySort = 'NEWEST' | 'OLDEST';

const DAY_MS = 24 * 60 * 60 * 1000;
const PERIOD_MS: Record<EntryPeriod, number | null> = {
    '1M': 30 * DAY_MS,
    '3M': 90 * DAY_MS,
    ALL: null,
};

const STATUS_VALUES: readonly EntryStatusFilter[] = ['ALL', 'PENDING', 'WON', 'LOST'];
const KIND_VALUES: readonly EntryKindFilter[] = ['ALL', 'RAFFLE', 'EVENT'];
const PERIOD_VALUES: readonly EntryPeriod[] = ['1M', '3M', 'ALL'];
const SORT_VALUES: readonly EntrySort[] = ['NEWEST', 'OLDEST'];

const pick = <T extends string>(values: readonly T[], raw: string | null, fallback: T): T =>
    values.includes(raw as T) ? (raw as T) : fallback;

/** 주소의 거르기 값을 읽는다 — 모르는 값은 기본값으로 (마이페이지 요약 칸이 status를 실어 보낸다) */
export function readEntryFilters(params: URLSearchParams) {
    return {
        status: pick(STATUS_VALUES, params.get('status'), 'ALL'),
        kind: pick(KIND_VALUES, params.get('kind'), 'ALL'),
        period: pick(PERIOD_VALUES, params.get('period'), '3M'),
        sort: pick(SORT_VALUES, params.get('sort'), 'NEWEST'),
    };
}

/** 종류·기간으로 먼저 거른다 — 결과 칸의 건수는 이 범위 안에서 센다 */
export function scopeEntryGroups(
    groups: readonly MyEntryGroup[],
    kind: EntryKindFilter,
    period: EntryPeriod,
    now: Date,
): MyEntryGroup[] {
    const span = PERIOD_MS[period];
    return groups.filter((group) => {
        if (kind === 'RAFFLE' && !group.isTimeRaffle) return false;
        if (kind === 'EVENT' && group.isTimeRaffle) return false;
        return span === null || now.getTime() - new Date(group.latestRequestedAt).getTime() <= span;
    });
}

/** 결과로 거르고 정렬한다 — 결과 거르기는 접수된 응모의 본인 결과(E09)만 본다 */
export function filterEntryGroups(
    groups: readonly MyEntryGroup[],
    status: EntryStatusFilter,
    sort: EntrySort,
): MyEntryGroup[] {
    const filtered =
        status === 'ALL' ? [...groups] : groups.filter((group) => group.result === status);
    return sort === 'OLDEST' ? filtered.reverse() : filtered;
}
