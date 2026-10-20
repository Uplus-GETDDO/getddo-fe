import type { LucideIcon } from 'lucide-react';

import { BellOff, ChevronRight, Hourglass, Megaphone, Shuffle, TriangleAlert } from 'lucide-react';
import { Link } from 'react-router-dom';

import { useAdminNotificationJobs } from '@entities/adminNotification';
import { useAdminEventStatusCounts, useAdminEvents } from '@entities/event';
import { useTicketInconsistencies } from '@entities/ticket';
import { useVirtualClock } from '@shared/model/virtualClock';
import { LoadingBlock, SkeletonRows } from '@shared/ui/skeleton';
import { cn } from '@shared/utils/cn';
import { formatRemaining } from '@shared/utils/date';
import { formatNumber } from '@shared/utils/format';

import { DashboardPanel } from './DashboardPanel';

/** 추첨 관리에서 당첨자를 정해야 하는 상태 */
const DRAW_NEEDED_STATUSES = ['CLOSED', 'REDRAWING'] as const;
/** 이 시간 안에 마감하는 진행 중 이벤트를 '곧 마감'으로 본다 */
const CLOSING_SOON_MS = 24 * 60 * 60 * 1000;
/** 진행 중 이벤트는 한 번에 최대치(100)로 받아 마감 순으로 고른다 */
const OPEN_EVENTS_SIZE = 100;

function QueueRow({
    icon: Icon,
    label,
    detail,
    count,
    unit,
    to,
}: {
    icon: LucideIcon;
    label: string;
    detail: string;
    count: number;
    unit: string;
    to: string;
}) {
    const idle = count === 0;
    return (
        <li>
            <Link
                to={to}
                className="group hover:bg-surface-sunken focus-visible:ring-border-focus -mx-2 flex items-center gap-3 rounded-xl px-2 py-3 transition-colors focus-visible:ring-2 focus-visible:outline-none"
            >
                {/* 아이콘은 바탕 없이 선 아이콘만 — 색 원은 장식이 과해 보여 뺐다 */}
                <Icon
                    aria-hidden
                    className={cn(
                        'size-5 shrink-0',
                        idle ? 'text-fg-tertiary' : 'text-fg-secondary',
                    )}
                />
                <span className="flex min-w-0 flex-col">
                    <span
                        // 타이포 토큰과 글자색은 cn으로 합치면 앞쪽이 지워져 문자열로 잇는다
                        className={`text-body-sm-bold ${idle ? 'text-fg-tertiary' : 'text-fg-primary'}`}
                    >
                        {label}
                    </span>
                    <span className="text-caption text-fg-tertiary truncate">{detail}</span>
                </span>
                <span
                    className={`text-body-bold ml-auto tabular-nums ${idle ? 'text-fg-tertiary' : 'text-fg-primary'}`}
                >
                    {formatNumber(count)}
                    {unit}
                </span>
                {/* 누르면 해당 관리 화면으로 간다는 표시 */}
                <ChevronRight
                    aria-hidden
                    className="text-fg-tertiary group-hover:text-fg-primary size-4 shrink-0"
                />
            </Link>
        </li>
    );
}

/**
 * 지금 처리할 일 — 추첨 필요·발표 대기·곧 마감·실패한 알림·정합성 불일치를 늘 같은 순서로 건수와 함께 보인다.
 * 0건인 일도 줄을 지우지 않고 흐리게 둬 칸이 들썩이지 않고, 할 일이 있는 줄만 진하게 읽힌다
 */
export function ActionQueuePanel() {
    const now = useVirtualClock().now();
    const publishWaiting = useAdminEvents({ page: 1, size: 1, status: 'DRAW_CONFIRMED' });
    // 마감했지만 아직 당첨자를 확정하지 않은 이벤트 — 마감(CLOSED)과 재추첨 중(REDRAWING)
    const drawNeeded = useAdminEventStatusCounts(DRAW_NEEDED_STATUSES);
    const failedJobs = useAdminNotificationJobs({ page: 1, size: 1, status: 'FAILED' });
    const mismatches = useTicketInconsistencies({ page: 1, size: 1 });
    const openEvents = useAdminEvents({ page: 1, size: OPEN_EVENTS_SIZE, status: 'OPEN' });

    const closingSoon = (openEvents.data?.items ?? [])
        .map((event) => ({ event, remainingMs: new Date(event.endsAt).getTime() - now.getTime() }))
        .filter(({ remainingMs }) => remainingMs > 0 && remainingMs <= CLOSING_SOON_MS)
        .sort((a, b) => a.remainingMs - b.remainingMs);
    const nearest = closingSoon[0];

    const queries = [publishWaiting, failedJobs, mismatches, openEvents];
    const isPending = queries.some((query) => query.isPending) || drawNeeded.isPending;
    const isError = queries.some((query) => query.isError) || drawNeeded.isError;

    const rows = [
        {
            icon: Shuffle,
            label: '추첨 필요',
            detail: '마감됐지만 당첨자를 아직 정하지 않았어요',
            count: drawNeeded.counts.reduce<number>((sum, count) => sum + (count ?? 0), 0),
            unit: '건',
            to: '/admin/draw',
        },
        {
            icon: Megaphone,
            label: '결과 발표 대기',
            detail: '추첨이 확정돼 발표만 남았어요',
            count: publishWaiting.data?.totalElements ?? 0,
            unit: '건',
            to: '/admin/draw',
        },
        {
            icon: Hourglass,
            label: '24시간 안에 마감',
            detail: nearest
                ? `${nearest.event.title} · ${formatRemaining(nearest.remainingMs, 'minute')} 남음`
                : '곧 마감하는 이벤트가 없어요',
            count: closingSoon.length,
            unit: '개',
            to: '/admin/events?status=OPEN',
        },
        {
            icon: BellOff,
            label: '실패한 알림 작업',
            detail: '복구 가능 여부를 확인해 주세요',
            count: failedJobs.data?.totalElements ?? 0,
            unit: '건',
            to: '/admin/notifications?tab=jobs&status=FAILED',
        },
        {
            icon: TriangleAlert,
            label: '응모권 정합성 불일치',
            detail: '응모권 상태와 마지막 이력이 달라요',
            count: mismatches.data?.totalElements ?? 0,
            unit: '장',
            to: '/admin/tickets?tab=consistency',
        },
    ];
    const pendingKinds = rows.filter((row) => row.count > 0).length;

    return (
        <DashboardPanel
            title="지금 처리할 일"
            caption={
                isPending
                    ? '확인할 일을 모으는 중이에요'
                    : pendingKinds === 0
                      ? '지금은 모두 처리됐어요'
                      : `확인이 필요한 일 ${pendingKinds}가지`
            }
            error={isError}
            hasData={queries.some((query) => query.data !== undefined) || drawNeeded.hasData}
            onRetry={() => {
                queries.forEach((query) => void query.refetch());
                drawNeeded.refetch();
            }}
        >
            {isPending ? (
                <LoadingBlock>
                    <SkeletonRows rows={5} />
                </LoadingBlock>
            ) : (
                <ul className="flex flex-col">
                    {rows.map((row) => (
                        <QueueRow key={row.label} {...row} />
                    ))}
                </ul>
            )}
        </DashboardPanel>
    );
}
