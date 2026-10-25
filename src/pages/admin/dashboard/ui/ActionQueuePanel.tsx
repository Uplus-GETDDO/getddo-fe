import { ChevronRight, CircleCheck } from 'lucide-react';
import { Link } from 'react-router-dom';

import { useAdminNotificationJobs } from '@entities/adminNotification';
import { useAdminEvents } from '@entities/event';
import { useVirtualClock } from '@shared/model/virtualClock';
import { LoadingBlock, SkeletonRows } from '@shared/ui/skeleton';
import { formatRemaining } from '@shared/utils/date';
import { formatNumber } from '@shared/utils/format';

import { DashboardPanel } from './DashboardPanel';

const PUBLISH_PREVIEW = 3;
/** 이 시간 안에 시작하는 진행 예정 이벤트를 '곧 시작'으로 본다 — 시작하면 수정할 수 없다 */
const STARTING_SOON_MS = 24 * 60 * 60 * 1000;
/** 진행 예정 이벤트는 최대치(100)로 받아 곧 시작하는 것만 센다 */
const SCHEDULED_SIZE = 100;

/**
 * 결과 발표 대기 — 이제 결과는 관리자가 직접 발표하므로(ADR-022) 가장 먼저 처리할 일로 맨 위에 크게 둔다.
 * 이벤트를 누르면 추첨 관리에서 그 이벤트가 열린 채로 간다
 */
function PublishWaitingCard({ query }: { query: ReturnType<typeof useAdminEvents> }) {
    const total = query.data?.totalElements ?? 0;

    return (
        <div className="flex flex-col gap-3">
            <div className="flex items-end gap-3">
                <span className="text-[2.5rem] leading-none font-bold tracking-tight tabular-nums">
                    {query.isPending ? '—' : query.isError ? '!' : formatNumber(total)}
                </span>
                <span className="flex flex-col pb-0.5">
                    <span className="text-body-sm-bold">결과 발표 대기</span>
                    <span className="text-caption text-fg-inverse/65">
                        추첨이 확정돼 공개만 남았어요
                    </span>
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
                <ul className="flex flex-col">
                    {query.data?.items.map((event) => (
                        <li key={event.id}>
                            <Link
                                to={`/admin/draw?eventId=${encodeURIComponent(event.id)}`}
                                className="text-body-sm hover:bg-surface-inverse-muted focus-visible:ring-fg-inverse -mx-2 flex items-center gap-2 rounded-lg px-2 py-2 transition-colors focus-visible:ring-2 focus-visible:outline-none"
                            >
                                <span className="truncate">{event.title}</span>
                                <ChevronRight
                                    aria-hidden
                                    className="text-fg-inverse/60 ml-auto size-4 shrink-0"
                                />
                            </Link>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}

/** 할 일 한 줄 — 왼쪽 큰 숫자, 이름·설명, 오른쪽 > . 먹색 판 위라 선은 옅은 흰 선 */
function QueueRow({
    label,
    detail,
    count,
    unit,
    to,
}: {
    label: string;
    detail: string;
    count: number;
    unit: string;
    to: string;
}) {
    return (
        <li className="border-fg-inverse/15 border-t">
            <Link
                to={to}
                className="group hover:bg-surface-inverse-muted focus-visible:ring-fg-inverse -mx-2 flex items-center gap-3 rounded-lg px-2 py-3.5 transition-colors focus-visible:ring-2 focus-visible:outline-none"
            >
                <span className="w-12 shrink-0 text-2xl leading-8 font-bold tabular-nums">
                    {formatNumber(count)}
                    <span className="text-fg-inverse/65 ml-0.5 text-xs font-medium">{unit}</span>
                </span>
                <span className="flex min-w-0 flex-col">
                    <span className="text-body-sm-bold">{label}</span>
                    <span className="text-caption text-fg-inverse/65 truncate">{detail}</span>
                </span>
                <ChevronRight
                    aria-hidden
                    className="text-fg-inverse/60 group-hover:text-fg-inverse ml-auto size-4 shrink-0"
                />
            </Link>
        </li>
    );
}

/**
 * 지금 처리할 일 — 관리자가 오늘 손을 대야 끝나는 일만 모은다(구경만 하는 지표는 넣지 않는다).
 * 1) 결과 발표 대기: 추첨이 확정돼 공개 버튼만 남은 이벤트 — 맨 위에 크게, 이벤트를 누르면 추첨 관리에서 그 이벤트가 열린다
 * 2) 재추첨 중: 끝나면 공개 명단을 갱신해야 한다
 * 3) 실패한 알림 작업: 복구해야 사용자에게 간다
 * 4) 24시간 안에 시작: 시작하면 수정할 수 없어 마지막으로 확인할 이벤트
 * 5) 오늘 어뷰징 탐지: 있을 때만 — 차단 내역에서 누가 왜 막혔는지 확인한다
 * 0건인 일은 숨기고, 모두 0건이면 "처리할 일이 없어요" 한 줄만 둔다. 메뉴로 가는 버튼은 사이드바와 겹쳐 두지 않는다
 */
export function ActionQueuePanel({
    abuseToday,
}: {
    /** 오늘 어뷰징 탐지 기록 수(AS01) — 몇 건인지보다 있는지가 중요해 있을 때만 확인할 일로 띄운다 */
    abuseToday?: { count: number; date: string };
}) {
    const now = useVirtualClock().now();
    const publishWaiting = useAdminEvents({
        page: 1,
        size: PUBLISH_PREVIEW,
        status: 'DRAW_CONFIRMED',
    });
    const redrawing = useAdminEvents({ page: 1, size: 1, status: 'REDRAWING' });
    const failedJobs = useAdminNotificationJobs({ page: 1, size: 1, status: 'FAILED' });
    // 곧 시작하는 것부터 받아야 앞 100건 안에 24시간 이내 시작이 다 든다 — 기본 정렬(등록 최신순)이면 뒤 쪽에 밀렸다
    const scheduled = useAdminEvents({
        page: 1,
        size: SCHEDULED_SIZE,
        status: 'SCHEDULED',
        sort: 'startsAt,asc',
    });

    const startingSoon = (scheduled.data?.items ?? [])
        .map((event) => ({
            event,
            untilStartMs: new Date(event.startsAt).getTime() - now.getTime(),
        }))
        .filter(({ untilStartMs }) => untilStartMs > 0 && untilStartMs <= STARTING_SOON_MS)
        .sort((a, b) => a.untilStartMs - b.untilStartMs);
    const nearest = startingSoon[0];

    const queries = [redrawing, failedJobs, scheduled];
    const isPending = queries.some((query) => query.isPending) || publishWaiting.isPending;
    const isError = queries.some((query) => query.isError);
    const publishCount = publishWaiting.data?.totalElements ?? 0;

    const rows = [
        {
            label: '재추첨 중',
            detail: '끝나면 공개 명단을 갱신해 주세요',
            count: redrawing.data?.totalElements ?? 0,
            unit: '건',
            to: '/admin/draw',
        },
        {
            label: '실패한 알림 작업',
            detail: '복구해야 사용자에게 알림이 가요',
            count: failedJobs.data?.totalElements ?? 0,
            unit: '건',
            to: '/admin/notifications?tab=jobs&status=FAILED',
        },
        {
            label: '24시간 안에 시작',
            detail: nearest
                ? `${nearest.event.title} · ${formatRemaining(nearest.untilStartMs, 'minute')} 뒤 시작 · 시작하면 수정할 수 없어요`
                : '',
            count: startingSoon.length,
            unit: '개',
            to: '/admin/events?status=SCHEDULED',
        },
        {
            label: '오늘 어뷰징 탐지',
            detail: '차단된 사용자와 판정 근거를 확인해 주세요',
            count: abuseToday?.count ?? 0,
            unit: '건',
            to: `/admin/abuse-cases?date=${abuseToday?.date ?? ''}`,
        },
    ].filter((row) => row.count > 0);
    const allClear =
        !isPending && publishCount === 0 && !publishWaiting.isError && rows.length === 0;

    return (
        <DashboardPanel
            title="지금 처리할 일"
            error={isError}
            onRetry={() => [...queries, publishWaiting].forEach((query) => void query.refetch())}
            tone="inverse"
        >
            {isPending ? (
                <LoadingBlock>
                    <SkeletonRows rows={3} />
                </LoadingBlock>
            ) : allClear ? (
                <p className="text-body-sm text-fg-inverse/80 flex flex-1 flex-col items-center justify-center gap-2 py-8">
                    <CircleCheck aria-hidden className="size-8" />
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
