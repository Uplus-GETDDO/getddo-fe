import { useEffect, useState } from 'react';

import {
    TICKET_GRADES,
    groupTicketHistories,
    useTicketHistories,
    TicketGradePill,
    type TicketHistoryGroup,
    type TicketOperationType,
} from '@entities/ticket';
import { useVirtualClock } from '@shared/model/virtualClock';
import { LoadError } from '@shared/ui/load-error';
import { Pagination } from '@shared/ui/pagination';
import { RefreshStatus } from '@shared/ui/refresh-status';
import { Segmented } from '@shared/ui/segmented';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@shared/ui/select';
import { SkeletonList } from '@shared/ui/skeleton';
import { formatKst, isSameKstDate, KST_HOUR_MINUTE } from '@shared/utils/date';
import { formatNumber } from '@shared/utils/format';
import { pageSlice } from '@shared/utils/pagination';

type Kind = 'ALL' | 'IN' | 'OUT' | 'EXPIRE_REFUND';
type Period = '7D' | '30D' | '90D' | 'ALL';

const DAY_MS = 24 * 60 * 60 * 1000;

/** 한 쪽에 담는 기록(한 번의 처리 = 한 줄) 수 */
const PAGE_SIZE = 10;
/** 한 번에 받는 원시 이력 수 — 한 줄에 여러 장이 묶이므로 쪽을 채우려면 넉넉히 받는다 */
const FETCH_SIZE = 20;

const KIND_OPTIONS = [
    { value: 'ALL', label: '전체' },
    { value: 'IN', label: '받은' },
    { value: 'OUT', label: '쓴' },
    { value: 'EXPIRE_REFUND', label: '만료·반환' },
] as const satisfies readonly { value: Kind; label: string }[];

// 받은 = 지급, 쓴 = 응모 사용, 만료·반환 = 기한 만료와 응모 취소로 돌아온 것. 정정은 '전체'에서만 보인다
const KIND_TYPES: Record<Exclude<Kind, 'ALL'>, readonly TicketOperationType[]> = {
    IN: ['GRANT'],
    OUT: ['USE'],
    EXPIRE_REFUND: ['EXPIRE', 'REFUND'],
};

const PERIOD_OPTIONS: { value: Period; label: string; days: number | null }[] = [
    { value: '7D', label: '최근 7일', days: 7 },
    { value: '30D', label: '최근 30일', days: 30 },
    { value: '90D', label: '최근 3개월', days: 90 },
    { value: 'ALL', label: '전체 기간', days: null },
];

/** 표 칸 너비 — 머리줄과 줄이 같은 값을 쓴다 */
const GRID = 'md:grid-cols-[minmax(0,1fr)_8.5rem_5rem_8rem]';

/** 만료 일시 칸 — 지급·반환은 쓸 수 있는 기한, 만료는 만료된 시각. 사용·정정은 기한이 의미 없어 비운다 */
const showsExpiry = (type: TicketOperationType) =>
    type === 'GRANT' || type === 'REFUND' || type === 'EXPIRE';

const expiryText = (iso: string) =>
    `${formatKst(iso, { month: 'long', day: 'numeric' })} ${formatKst(iso, KST_HOUR_MINUTE)}`;

/** 날짜(KST)별로 묶는다 — 들어온 순서(최신순)를 유지한다 */
function byDate(groups: TicketHistoryGroup[], now: Date) {
    const dates = new Map<string, TicketHistoryGroup[]>();
    for (const group of groups) {
        const day = formatKst(group.createdAt, { month: 'long', day: 'numeric' });
        const label = isSameKstDate(group.createdAt, now) ? `${day} 오늘` : day;
        dates.set(label, [...(dates.get(label) ?? []), group]);
    }
    return [...dates.entries()];
}

/**
 * 응모권 기록 — 한 번의 처리(지급·응모 사용·반환·만료)를 한 줄로, 날짜별로 보여 준다.
 * 마이페이지 "응모권 내역 → 전체 보기"는 페이지 맨 위(큰 응모권)부터 연다.
 * 번호로 넘긴다 — 서버는 커서 방식이라(ADR-0009) 보려는 쪽이 찰 때까지 nextCursor를 차례로 따라 받는다.
 * 쪽 끝 줄이 다음 이력과 같은 처리일 수 있어 한 줄 더 받아 두고 자른다 — 끝 줄 수량이 넘긴 뒤에 바뀌지 않게.
 * 전체 쪽 수는 받은 만큼만 센다(이력이 여러 종류 흐름을 합친 것이라 총 줄 수를 미리 알 수 없다)
 */
export function TicketHistoryCard({ now }: { now: Date }) {
    const [kind, setKind] = useState<Kind>('ALL');
    const [period, setPeriod] = useState<Period>('30D');
    const [page, setPage] = useState(1);
    const clock = useVirtualClock();
    const periodKey = `${clock.override?.toISOString() ?? 'real'}:${formatKst(now, { year: 'numeric', month: '2-digit', day: '2-digit' })}:${kind}:${period}`;
    const [anchor, setAnchor] = useState({ key: periodKey, time: now.getTime() });
    const time = anchor.key === periodKey ? anchor.time : now.getTime();
    if (anchor.key !== periodKey) setAnchor({ key: periodKey, time });
    const days = PERIOD_OPTIONS.find((option) => option.value === period)?.days ?? null;
    const types = kind === 'ALL' ? undefined : KIND_TYPES[kind];
    const query = useTicketHistories({
        size: FETCH_SIZE,
        ...(types?.length === 1
            ? { operationType: types[0] }
            : { operationTypes: types ? [...types] : undefined }),
        ...(days === null
            ? {}
            : {
                  from: new Date(time - days * DAY_MS).toISOString(),
                  to: new Date(time).toISOString(),
              }),
    });
    const shown = groupTicketHistories(query.items);
    const { isPending, isError } = query;
    const paged = pageSlice(shown, page, PAGE_SIZE);

    // 보려는 쪽 + 한 줄이 찰 때까지 다음 커서를 받는다. 실패하면 멈추고 다시 시도를 기다린다
    const { hasNextPage, isFetchingNextPage, isFetchNextPageError, fetchNextPage, cursorError } =
        query;
    const needed = page * PAGE_SIZE + 1;
    const loaded = shown.length;
    useEffect(() => {
        if (
            !isPending &&
            loaded < needed &&
            hasNextPage &&
            !isFetchingNextPage &&
            !isFetchNextPageError &&
            !cursorError
        )
            void fetchNextPage({ cancelRefetch: false });
    }, [
        isPending,
        loaded,
        needed,
        hasNextPage,
        isFetchingNextPage,
        isFetchNextPageError,
        cursorError,
        fetchNextPage,
    ]);
    const pageLoading = loaded < page * PAGE_SIZE && hasNextPage && !isFetchNextPageError;
    const failed = isError || cursorError;
    const retry = () =>
        void (!cursorError && isFetchNextPageError
            ? fetchNextPage({ cancelRefetch: false })
            : query.refetch());

    return (
        <section
            aria-labelledby="ticket-history-title"
            className="bg-surface-page border-border-default flex flex-col gap-2 rounded-2xl border p-6 shadow-md"
        >
            <div className="flex items-center justify-between gap-3">
                <h2 id="ticket-history-title" className="text-title-3 text-fg-primary">
                    응모권 기록
                </h2>
                <Select
                    value={period}
                    onValueChange={(value) => {
                        setPeriod(value as Period);
                        setPage(1);
                    }}
                >
                    <SelectTrigger className="h-9" aria-label="기간">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        {PERIOD_OPTIONS.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                                {option.label}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
            <Segmented
                label="처리 종류로 거르기"
                value={kind}
                options={KIND_OPTIONS}
                onValueChange={(value) => {
                    setKind(value);
                    setPage(1);
                }}
                className="mb-2 self-start"
            />

            <div
                aria-hidden
                className={`bg-surface-sunken text-caption text-fg-tertiary hidden gap-x-4 rounded-lg px-3 py-2 md:grid ${GRID}`}
            >
                <span>내용</span>
                <span>등급</span>
                <span className="text-right">수량</span>
                <span className="text-right">만료 일시</span>
            </div>

            {isPending && (
                <p role="status" className="sr-only">
                    응모권 내역을 불러오는 중
                </p>
            )}
            {isPending && <SkeletonList count={5} className="py-3" />}
            {/* 받아 둔 기록이 있으면 그대로 두고 작은 갱신 실패 표시만, 하나도 없을 때만 실패 칸 */}
            {failed && shown.length > 0 && (
                <RefreshStatus
                    fetching={query.isFetching}
                    error
                    onRefresh={retry}
                    className="self-start"
                />
            )}
            {failed && shown.length === 0 && (
                <LoadError
                    title="응모권 기록을 불러오지 못했어요"
                    onRetry={retry}
                    retrying={query.isFetching}
                />
            )}
            {!isPending && !failed && shown.length === 0 && (
                <p role="status" className="text-body-sm text-fg-tertiary py-10 text-center">
                    이 기간에 기록이 없어요.
                </p>
            )}
            {byDate(paged.items, now).map(([date, items]) => (
                <div key={date} className="flex flex-col">
                    <h3 className="text-caption text-fg-tertiary px-3 pt-3 pb-1">{date}</h3>
                    <ul>
                        {items.map((group) => (
                            <li
                                key={group.key}
                                className={`grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 px-3 py-3.5 ${GRID}`}
                            >
                                <div className="flex min-w-0 flex-col">
                                    <span className="text-body-bold text-fg-primary truncate">
                                        {group.reason}
                                    </span>
                                    <span className="text-body-sm text-fg-tertiary">
                                        {group.detail}
                                    </span>
                                </div>
                                <div className="order-3 col-span-2 flex flex-wrap gap-1 md:order-none md:col-span-1">
                                    {TICKET_GRADES.filter(
                                        (grade) => group.countByGrade[grade] > 0,
                                    ).map((grade) => (
                                        <TicketGradePill
                                            key={grade}
                                            grade={grade}
                                            // 장수는 수량 칸이 보여 준다 — 등급이 섞였을 때만 등급별 장수를 붙인다
                                            count={
                                                TICKET_GRADES.filter(
                                                    (g) => group.countByGrade[g] > 0,
                                                ).length > 1
                                                    ? group.countByGrade[grade]
                                                    : undefined
                                            }
                                        />
                                    ))}
                                </div>
                                <span
                                    className={`text-right ${
                                        group.delta !== null && group.delta > 0
                                            ? 'text-body-sm-bold text-fg-primary'
                                            : 'text-body-sm text-fg-secondary'
                                    }`}
                                >
                                    {group.delta === null
                                        ? '—'
                                        : `${group.delta > 0 ? '+' : '−'}${formatNumber(Math.abs(group.delta))}장`}
                                </span>
                                <span className="text-caption text-fg-tertiary order-4 col-span-2 md:order-none md:col-span-1 md:text-right">
                                    {showsExpiry(group.operationType) ? (
                                        <>
                                            <span className="md:hidden">
                                                {group.operationType === 'EXPIRE'
                                                    ? '만료 '
                                                    : '사용 기한 '}
                                            </span>
                                            {expiryText(group.expiresAt)}
                                        </>
                                    ) : (
                                        <span className="hidden md:inline">—</span>
                                    )}
                                </span>
                            </li>
                        ))}
                    </ul>
                </div>
            ))}
            {pageLoading && <SkeletonList count={3} className="py-3" />}
            {/* 쪽 수는 받은 기록만큼 늘어난다 — 마지막 쪽을 열면 그다음 기록을 이어 받는다 */}
            {paged.totalPages > 1 && (
                <Pagination
                    page={paged.current}
                    totalPages={paged.totalPages}
                    onPageChange={setPage}
                    label="응모권 기록 페이지"
                    className="justify-center pt-4"
                />
            )}
        </section>
    );
}
