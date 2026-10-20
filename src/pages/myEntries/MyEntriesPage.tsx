import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import type { MyEntryRow } from '@widgets/myEntryRows';

import { useVirtualClock } from '@shared/model/virtualClock';
import { PageHeader } from '@shared/ui/page-header';
import { Pagination } from '@shared/ui/pagination';
import { Segmented } from '@shared/ui/segmented';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@shared/ui/select';
import { SkeletonList } from '@shared/ui/skeleton';
import { formatKst, formatKstDot } from '@shared/utils/date';
import { formatNumber } from '@shared/utils/format';
import { pageSlice } from '@shared/utils/pagination';
import { latestWonAt, MyEntryRefreshStatus, useMyEntryRows } from '@widgets/myEntryRows';

import type { StatusTile } from './ui/EntryStatusTiles';

import { EntryStatusTiles } from './ui/EntryStatusTiles';
import { ENTRY_GRID, EntryTableRow } from './ui/EntryTableRow';
import {
    filterEntryRows,
    readEntryFilters,
    scopeEntryRows,
    type EntryKindFilter,
    type EntryPeriod,
    type EntrySort,
    type EntryStatusFilter,
} from './utils/filterEntries';

/** 한 쪽에 담는 줄 수 */
const PAGE_SIZE = 20;

const KIND_OPTIONS = [
    { value: 'ALL', label: '전체' },
    { value: 'RAFFLE', label: '겟또타임' },
    { value: 'EVENT', label: '이벤트' },
] as const satisfies readonly { value: EntryKindFilter; label: string }[];

const PERIOD_LABEL: Record<EntryPeriod, string> = {
    '1M': '최근 1개월',
    '3M': '최근 3개월',
    ALL: '전체 기간',
};

const SORT_LABEL: Record<EntrySort, string> = { NEWEST: '최신순', OLDEST: '오래된순' };

/** 월(KST)별로 묶는다 — 들어온 순서를 유지한다 */
function byMonth(rows: MyEntryRow[]) {
    const months = new Map<string, MyEntryRow[]>();
    for (const row of rows) {
        const label = formatKst(row.entry.requestedAt, { year: 'numeric', month: 'long' });
        months.set(label, [...(months.get(label) ?? []), row]);
    }
    return [...months.entries()];
}

/**
 * 내 응모 내역 — 마이페이지 "응모 내역 → 전체 보기"와 요약 칸(응모 중·당첨)이 여는 페이지.
 * 결과 칸이 거르기를 겸하고, 거르기 값은 주소(status·kind·period·sort)에 실어 뒤로 가기·공유가 된다.
 * 결과는 서버가 공개한 본인 결과(E09)만 쓴다 — 발표 전에는 발표 대기로만 보인다
 */
export function MyEntriesPage() {
    const [params, setParams] = useSearchParams();
    const filters = readEntryFilters(params);
    const clock = useVirtualClock();
    const now = clock.now();
    const [page, setPage] = useState(1);
    const entriesQuery = useMyEntryRows({
        // 화면 목록과 같은 pageSlice로 자른다 — 줄이 줄어 쪽 수가 당겨져도 보이는 쪽의 발표 대기를 계속 폴링한다
        selectVisibleRows: (rows) =>
            pageSlice(
                filterEntryRows(
                    scopeEntryRows(rows, filters.kind, filters.period, now),
                    filters.status,
                    filters.sort,
                ),
                page,
                PAGE_SIZE,
            ).items,
    });
    const { rows, isPending, isError, isResultPending } = entriesQuery;

    const setFilter = (key: string, value: string, fallback: string) => {
        setParams(
            (prev) => {
                const next = new URLSearchParams(prev);
                if (value === fallback) next.delete(key);
                else next.set(key, value);
                return next;
            },
            { replace: true },
        );
        setPage(1);
    };

    const scoped = scopeEntryRows(rows, filters.kind, filters.period, now);
    const shown = filterEntryRows(scoped, filters.status, filters.sort);
    const paged = pageSlice(shown, page, PAGE_SIZE);
    const pending = scoped.filter((row) => row.result === 'PENDING');
    const won = scoped.filter((row) => row.result === 'WON');
    const lost = scoped.filter((row) => row.result === 'LOST');
    const lastWonAt = latestWonAt(won);
    const lostTickets = lost.reduce((sum, row) => sum + row.entry.deductedTicketCount, 0);

    const tiles: StatusTile[] = [
        { value: 'ALL', label: '전체', count: scoped.length, note: PERIOD_LABEL[filters.period] },
        {
            value: 'PENDING',
            label: '발표 대기',
            count: pending.length,
            note:
                pending.length > 0
                    ? '결과 발표를 기다리고 있어요'
                    : '발표를 기다리는 응모가 없어요',
        },
        {
            value: 'WON',
            label: '당첨',
            count: won.length,
            note: lastWonAt ? `최근 당첨 ${formatKstDot(lastWonAt)}` : '아직 당첨이 없어요',
        },
        {
            value: 'LOST',
            label: '미당첨',
            count: lost.length,
            note:
                lostTickets > 0
                    ? `응모권 ${formatNumber(lostTickets)}장 사용`
                    : '응모권을 쓴 미당첨이 없어요',
        },
    ];

    return (
        <main className="mx-auto flex w-full max-w-312 flex-col gap-6 px-6 pb-28">
            <PageHeader
                backTo="/mypage"
                backLabel="마이페이지"
                title="내 응모 내역"
                description="이벤트·겟또타임에 응모한 기록과 결과를 모두 볼 수 있어요."
                action={<MyEntryRefreshStatus query={entriesQuery} />}
            />

            <EntryStatusTiles
                isPending={isPending || isResultPending}
                isEntriesError={entriesQuery.isError}
                isUnavailable={entriesQuery.isResultInitialError}
                tiles={tiles}
                value={filters.status}
                onChange={(value: EntryStatusFilter) => setFilter('status', value, 'ALL')}
            />

            <section
                id="entry-list"
                aria-label="응모 기록"
                className="bg-surface-page border-border-default flex scroll-mt-24 flex-col gap-2 rounded-2xl border p-6 shadow-md"
            >
                <div className="flex flex-wrap items-center justify-between gap-3 pb-2">
                    <Segmented
                        label="종류로 거르기"
                        value={filters.kind}
                        options={KIND_OPTIONS}
                        onValueChange={(value) => setFilter('kind', value, 'ALL')}
                    />
                    <div className="flex gap-2">
                        <Select
                            value={filters.period}
                            onValueChange={(value) => setFilter('period', value, '3M')}
                        >
                            <SelectTrigger className="h-9" aria-label="기간">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {Object.entries(PERIOD_LABEL).map(([value, label]) => (
                                    <SelectItem key={value} value={value}>
                                        {label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <Select
                            value={filters.sort}
                            onValueChange={(value) => setFilter('sort', value, 'NEWEST')}
                        >
                            <SelectTrigger className="h-9" aria-label="정렬">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {Object.entries(SORT_LABEL).map(([value, label]) => (
                                    <SelectItem key={value} value={value}>
                                        {label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                <div
                    aria-hidden
                    className={`bg-surface-sunken text-caption text-fg-tertiary hidden gap-x-4 rounded-lg px-3 py-2 md:grid ${ENTRY_GRID}`}
                >
                    {/* 줄의 1열은 썸네일(size-13) + gap-3 뒤에 제목이 오므로 머리글도 그만큼 들여쓴다 */}
                    <span className="pl-16">응모</span>
                    <span>사용 응모권</span>
                    <span className="text-right">결과</span>
                    <span />
                </div>

                {isPending && <SkeletonList count={5} rowClassName="h-16" className="py-3" />}
                {isError && (
                    <p className="text-destructive text-body-sm py-6">
                        응모 내역을 불러오지 못했습니다.
                    </p>
                )}
                {!isPending &&
                    !isResultPending &&
                    !isError &&
                    !(entriesQuery.isResultInitialError && filters.status !== 'ALL') &&
                    shown.length === 0 && (
                        <p className="text-body-sm text-fg-tertiary py-10 text-center">
                            {rows.length === 0
                                ? '아직 응모한 내역이 없어요.'
                                : '조건에 맞는 응모 내역이 없어요.'}
                        </p>
                    )}
                {byMonth(paged.items).map(([month, monthRows]) => (
                    <div key={month} className="flex flex-col">
                        <h2 className="text-body-sm-bold text-fg-primary px-3 pt-3 pb-1">
                            {month}
                        </h2>
                        <ul className="divide-border-default divide-y">
                            {monthRows.map((row) => (
                                <EntryTableRow key={row.entry.id} row={row} />
                            ))}
                        </ul>
                    </div>
                ))}
                {paged.totalPages > 1 && (
                    <Pagination
                        page={paged.current}
                        totalPages={paged.totalPages}
                        onPageChange={(next) => {
                            setPage(next);
                            // 새 쪽은 목록 머리부터 읽게 올린다
                            document
                                .getElementById('entry-list')
                                ?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
                        }}
                        label="응모 기록 페이지"
                        className="justify-center pt-4"
                    />
                )}
            </section>
        </main>
    );
}
