import type { LucideIcon } from 'lucide-react';

import { BellOff, ChevronRight, CircleCheck, Hourglass, Megaphone } from 'lucide-react';
import { Link } from 'react-router-dom';

import { useAdminNotificationJobs } from '@entities/adminNotification';
import { useAdminEvents } from '@entities/event';
import { useVirtualClock } from '@shared/model/virtualClock';
import { Button } from '@shared/ui/button';
import { LoadingBlock, SkeletonRows } from '@shared/ui/skeleton';
import { formatRemaining } from '@shared/utils/date';
import { formatNumber } from '@shared/utils/format';

import { DashboardPanel } from './DashboardPanel';

const PUBLISH_PREVIEW = 3;
/** 이 시간 안에 마감하는 진행 중 이벤트를 '곧 마감'으로 본다 */
const CLOSING_SOON_MS = 24 * 60 * 60 * 1000;

/**
 * 결과 발표 대기 — 이제 결과는 관리자가 직접 발표하므로(ADR-022) 가장 먼저 처리할 일로 진하게 띄운다.
 * 이벤트를 누르면 추첨 관리에서 그 이벤트가 열린 채로 간다
 */
function PublishWaitingCard({ query }: { query: ReturnType<typeof useAdminEvents> }) {
    const total = query.data?.totalElements ?? 0;

    return (
        <div className="bg-surface-inverse text-fg-inverse flex flex-col gap-3 rounded-xl p-4">
            <div className="flex items-center gap-2">
                <Megaphone aria-hidden className="size-4" />
                <span className="text-body-sm-bold">결과 발표 대기</span>
                <span className="text-title-3 ml-auto tabular-nums">
                    {query.isPending ? '—' : query.isError ? '!' : `${formatNumber(total)}건`}
                </span>
            </div>
            {query.isError ? (
                <button
                    type="button"
                    className="text-caption text-fg-inverse/70 self-start underline"
                    onClick={() => void query.refetch()}
                >
                    불러오지 못했어요 · 다시 시도
                </button>
            ) : (
                <ul className="flex flex-col gap-1">
                    {query.data?.items.map((event) => (
                        <li key={event.id}>
                            <Link
                                to={`/admin/draw?eventId=${encodeURIComponent(event.id)}`}
                                className="text-body-sm hover:bg-surface-inverse-muted focus-visible:ring-fg-inverse -mx-2 flex items-center gap-2 rounded-lg px-2 py-1.5 transition-colors focus-visible:ring-2 focus-visible:outline-none"
                            >
                                <span className="truncate">{event.title}</span>
                                <ChevronRight aria-hidden className="ml-auto size-4 shrink-0" />
                            </Link>
                        </li>
                    ))}
                </ul>
            )}
            <Button size="sm" variant="secondary" asChild className="self-stretch">
                <Link to="/admin/draw">추첨 관리로 가기</Link>
            </Button>
        </div>
    );
}

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
    return (
        <li>
            <Link
                to={to}
                className="group hover:bg-surface-sunken focus-visible:ring-border-focus -mx-2 flex items-center gap-3 rounded-xl px-2 py-3 transition-colors focus-visible:ring-2 focus-visible:outline-none"
            >
                {/* 아이콘은 바탕 없이 선 아이콘만 — 색 원은 장식이 과해 보여 뺐다 */}
                <Icon aria-hidden className="text-fg-secondary size-5 shrink-0" />
                <span className="flex min-w-0 flex-col">
                    <span className="text-body-sm-bold text-fg-primary">{label}</span>
                    <span className="text-caption text-fg-tertiary truncate">{detail}</span>
                </span>
                <span className="text-body-bold text-fg-primary ml-auto tabular-nums">
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
 * 지금 처리할 일 — 발표 대기를 맨 위에, 그 아래 실패 알림·곧 마감을 건수와 함께 모은다.
 * 0건인 일은 접어 숨기고, 모두 0건이면 "처리할 일이 없어요" 한 줄만 둔다 — 할 일이 있을 때만 눈에 띄게
 */
export function ActionQueuePanel({
    openEvents,
}: {
    /** 진행 중 이벤트 목록 — 페이지가 같은 키를 한 번만 구독해 나눠 준다 */
    openEvents: ReturnType<typeof useAdminEvents>;
}) {
    const now = useVirtualClock().now();
    const publishWaiting = useAdminEvents({
        page: 1,
        size: PUBLISH_PREVIEW,
        status: 'DRAW_CONFIRMED',
    });
    const failedJobs = useAdminNotificationJobs({ page: 1, size: 1, status: 'FAILED' });

    const closingSoon = (openEvents.data?.items ?? [])
        .map((event) => ({ event, remainingMs: new Date(event.endsAt).getTime() - now.getTime() }))
        .filter(({ remainingMs }) => remainingMs > 0 && remainingMs <= CLOSING_SOON_MS)
        .sort((a, b) => a.remainingMs - b.remainingMs);
    const nearest = closingSoon[0];

    const queries = [failedJobs, openEvents];
    const isPending = queries.some((query) => query.isPending) || publishWaiting.isPending;
    const isError = queries.some((query) => query.isError);
    const publishCount = publishWaiting.data?.totalElements ?? 0;

    const rows = [
        {
            icon: BellOff,
            label: '실패한 알림 작업',
            detail: '복구 가능 여부를 확인해 주세요',
            count: failedJobs.data?.totalElements ?? 0,
            unit: '건',
            to: '/admin/notifications?tab=jobs&status=FAILED',
        },
        {
            icon: Hourglass,
            label: '24시간 안에 마감',
            detail: nearest
                ? `${nearest.event.title} · ${formatRemaining(nearest.remainingMs, 'minute')} 남음`
                : '',
            count: closingSoon.length,
            unit: '개',
            to: '/admin/events?status=OPEN',
        },
    ].filter((row) => row.count > 0);
    // 요약 문구용 — 발표 대기와 남은 줄의 가짓수
    const pendingKinds = (publishCount > 0 ? 1 : 0) + rows.length;
    const allClear =
        !isPending && publishCount === 0 && !publishWaiting.isError && rows.length === 0;

    return (
        <DashboardPanel
            title="지금 처리할 일"
            caption={
                isPending
                    ? '확인할 일을 모으는 중이에요'
                    : allClear
                      ? '지금은 모두 처리됐어요'
                      : `확인이 필요한 일 ${pendingKinds}가지`
            }
            error={isError}
            onRetry={() => [...queries, publishWaiting].forEach((query) => void query.refetch())}
        >
            {isPending ? (
                <LoadingBlock>
                    <SkeletonRows rows={3} />
                </LoadingBlock>
            ) : allClear ? (
                <p className="text-body-sm text-fg-secondary flex flex-1 flex-col items-center justify-center gap-2 py-8">
                    <CircleCheck aria-hidden className="text-semantic-success size-8" />
                    처리할 일이 없어요
                </p>
            ) : (
                <>
                    {(publishCount > 0 || publishWaiting.isError) && (
                        <PublishWaitingCard query={publishWaiting} />
                    )}
                    {rows.length > 0 && (
                        <ul className="flex flex-col">
                            {rows.map((row) => (
                                <QueueRow key={row.label} {...row} />
                            ))}
                        </ul>
                    )}
                </>
            )}
        </DashboardPanel>
    );
}
