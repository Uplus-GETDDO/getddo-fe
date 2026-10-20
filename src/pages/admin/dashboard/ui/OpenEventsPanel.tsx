import { Link, useNavigate } from 'react-router-dom';

import type { EntryStatistics } from '@entities/entry';
import type { AdminEvent } from '@entities/event';

import { useEntryStatisticsList } from '@entities/entry';
import { useAdminEvents } from '@entities/event';
import { useVirtualClock } from '@shared/model/virtualClock';
import { badgeVariants } from '@shared/ui/badge';
import { LoadingBlock, SkeletonRows } from '@shared/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@shared/ui/table';
import { cn } from '@shared/utils/cn';
import { formatKstDot, formatRemaining } from '@shared/utils/date';
import { formatNumber } from '@shared/utils/format';

import { DashboardPanel } from './DashboardPanel';
import { ViewAllLink } from './ViewAllLink';

const PREVIEW = 5;
/** 진행 중 이벤트는 최대치(100)로 받아 마감이 가까운 순으로 고른다 */
const OPEN_EVENTS_SIZE = 100;
/** 1시간 안에 마감하면 '마감 임박' */
const URGENT_MS = 60 * 60 * 1000;
/** 목록 안 최다 대비 이 비율 미만이면 '응모 저조' */
const LOW_RATIO = 0.25;

/** 숫자를 비교하지 않아도 되게 판단을 칩으로 — 마감 임박 > 인기 > 응모 저조 순으로 하나만 */
const STATUS_CHIP = {
    urgent: { label: '마감 임박', className: 'bg-status-pending text-status-pending-text' },
    hot: { label: '인기', className: 'bg-brand-soft text-fg-brand' },
    low: { label: '응모 저조', className: 'bg-surface-sunken text-fg-secondary' },
} as const;

function eventStatus(remainingMs: number, spent: number | undefined, maxSpent: number) {
    if (remainingMs <= URGENT_MS) return STATUS_CHIP.urgent;
    if (spent === undefined || maxSpent === 0) return null;
    if (spent === maxSpent) return STATUS_CHIP.hot;
    if (spent / maxSpent < LOW_RATIO) return STATUS_CHIP.low;
    return null;
}

/** 이벤트 한 줄 — 마감까지 남은 시간, 응모자 수, 쓰인 응모권(E03)과 목록 안 최댓값 대비 막대 */
function OpenEventRow({
    index,
    event,
    remainingMs,
    stats,
    maxSpent,
}: {
    index: number;
    event: AdminEvent;
    remainingMs: number;
    /** undefined 불러오는 중, null 조회 실패 */
    stats: EntryStatistics | null | undefined;
    maxSpent: number;
}) {
    const navigate = useNavigate();
    const to = `/admin/events/${encodeURIComponent(event.id)}`;
    const spent = stats?.totalSpentTicketCount ?? 0;
    const ratio = maxSpent > 0 ? spent / maxSpent : 0;
    const status = eventStatus(remainingMs, stats?.totalSpentTicketCount, maxSpent);
    const fallback = stats === null ? '—' : '…';

    return (
        <TableRow
            className="hover:bg-surface-sunken cursor-pointer"
            onClick={() => void navigate(to)}
        >
            <TableCell className="text-fg-tertiary w-10 tabular-nums">{index + 1}</TableCell>
            <TableCell className="max-w-64">
                {/* 줄 전체 클릭과 별개로 키보드·화면 낭독기용 링크를 둔다 */}
                <Link
                    to={to}
                    onClick={(e) => e.stopPropagation()}
                    className="text-body-sm-bold text-fg-primary focus-visible:ring-border-focus block truncate rounded focus-visible:ring-2 focus-visible:outline-none"
                >
                    {event.title}
                </Link>
                <span className="text-caption text-fg-tertiary flex items-center gap-2 tabular-nums">
                    {formatKstDot(event.endsAt, true)} 마감
                    <Link
                        to={`/admin/entries?view=participants&eventId=${encodeURIComponent(event.id)}`}
                        onClick={(e) => e.stopPropagation()}
                        className="text-fg-brand focus-visible:ring-border-focus rounded hover:underline focus-visible:ring-2 focus-visible:outline-none"
                    >
                        참여자 조회
                    </Link>
                </span>
            </TableCell>
            <TableCell className="text-body-sm text-fg-secondary tabular-nums">
                {formatRemaining(remainingMs, 'minute')} 남음
            </TableCell>
            <TableCell className="text-body-sm pr-10 text-right tabular-nums">
                {stats ? `${formatNumber(stats.participantCount)}명` : fallback}
            </TableCell>
            <TableCell className="w-56">
                <span className="flex items-center gap-3">
                    <span className="bg-surface-sunken h-1.5 flex-1 overflow-hidden rounded-full">
                        <span
                            className="bg-chart-line block h-full rounded-full transition-[width] duration-500 motion-reduce:transition-none"
                            style={{ width: `${Math.max(ratio * 100, spent ? 2 : 0)}%` }}
                        />
                    </span>
                    <span className="text-body-sm w-16 text-right tabular-nums">
                        {stats ? `${formatNumber(spent)}장` : fallback}
                    </span>
                </span>
            </TableCell>
            <TableCell className="w-28 text-center">
                {status && (
                    <span className={cn(badgeVariants({ variant: null }), status.className)}>
                        {status.label}
                    </span>
                )}
            </TableCell>
        </TableRow>
    );
}

/** 진행 중 이벤트 응모 현황 — 마감이 가까운 순 표. 어느 이벤트에 응모가 몰리는지 막대로 비교한다 */
export function OpenEventsPanel({ className }: { className?: string }) {
    const now = useVirtualClock().now();
    const query = useAdminEvents({ page: 1, size: OPEN_EVENTS_SIZE, status: 'OPEN' });

    const events = (query.data?.items ?? [])
        .map((event) => ({ event, remainingMs: new Date(event.endsAt).getTime() - now.getTime() }))
        .filter(({ remainingMs }) => remainingMs > 0)
        .sort((a, b) => a.remainingMs - b.remainingMs)
        .slice(0, PREVIEW);
    const stats = useEntryStatisticsList(events.map(({ event }) => event.id));
    const maxSpent = Math.max(0, ...stats.map((item) => item?.totalSpentTicketCount ?? 0));

    return (
        <DashboardPanel
            title="진행 중 이벤트 응모 현황"
            caption={
                query.data
                    ? `진행 중 ${formatNumber(query.data.totalElements)}개 중 마감이 가까운 ${events.length}개`
                    : '마감이 가까운 순'
            }
            actions={<ViewAllLink to="/admin/events?status=OPEN" />}
            error={query.isError}
            onRetry={() => void query.refetch()}
            className={className}
        >
            {query.isPending ? (
                <LoadingBlock>
                    <SkeletonRows rows={4} />
                </LoadingBlock>
            ) : events.length === 0 ? (
                <p className="text-body-sm text-fg-tertiary py-6 text-center">
                    진행 중인 이벤트가 없습니다.
                </p>
            ) : (
                <Table>
                    <TableHeader>
                        <TableRow className="hover:bg-transparent">
                            <TableHead className="text-fg-tertiary">No</TableHead>
                            <TableHead className="text-fg-tertiary">이벤트</TableHead>
                            <TableHead className="text-fg-tertiary">마감까지</TableHead>
                            <TableHead className="text-fg-tertiary pr-10 text-right">
                                응모자
                            </TableHead>
                            <TableHead className="text-fg-tertiary">사용 응모권</TableHead>
                            <TableHead className="text-fg-tertiary text-center">상태</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {events.map(({ event, remainingMs }, index) => (
                            <OpenEventRow
                                key={event.id}
                                index={index}
                                event={event}
                                remainingMs={remainingMs}
                                stats={stats[index]}
                                maxSpent={maxSpent}
                            />
                        ))}
                    </TableBody>
                </Table>
            )}
        </DashboardPanel>
    );
}
