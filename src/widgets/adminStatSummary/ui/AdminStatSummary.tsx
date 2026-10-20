import type { UseQueryResult } from '@tanstack/react-query';

import { ArrowDownRight, ArrowUpRight, ChevronRight, Minus } from 'lucide-react';
import { Link } from 'react-router-dom';

import type { DailyStats, DailyStatsDay } from '@entities/adminStats';

import { useAdminEvents } from '@entities/event';
import { Button } from '@shared/ui/button';
import { Skeleton } from '@shared/ui/skeleton';
import { cn } from '@shared/utils/cn';
import { formatNumber } from '@shared/utils/format';

interface StatCardProps {
    label: string;
    /** 아직 안 오면 —, 조회 실패는 error로 구분해 짧게 표시한다 */
    value?: number;
    /** 초기 조회 중이면 값 자리에 스켈레톤 — 카드 껍데기(제목·설명·링크)는 그대로 둔다 */
    pending?: boolean;
    /** 조회 실패 — 값 자리에 실패 문구를 두고 재시도 버튼을 연다 */
    error?: boolean;
    onRetry?: () => void;
    description: string;
    /** 관리 화면 링크 — 없으면 카드는 조회 전용 표시가 된다 */
    to?: string;
    /** 값 뒤 단위 — 이벤트·기록은 건, 응모권은 장 */
    unit?: string;
    /** 어제 같은 지표 — 있으면 설명 대신 어제보다 늘었는지·줄었는지 적는다 */
    previous?: number;
}

/** 어제와 비교 — 늘고 준 것이 좋고 나쁨을 뜻하지 않으므로 색 대신 화살표로만 구분한다 */
function Delta({ value, previous, unit }: { value: number; previous: number; unit: string }) {
    const diff = value - previous;
    const Icon = diff > 0 ? ArrowUpRight : diff < 0 ? ArrowDownRight : Minus;
    return (
        <span className="text-caption text-fg-tertiary flex items-center gap-1 tabular-nums">
            <span className="text-fg-primary flex items-center gap-0.5 font-semibold">
                <Icon aria-hidden className="size-3.5" />
                {diff === 0
                    ? '변화 없음'
                    : `${diff > 0 ? '+' : '−'}${formatNumber(Math.abs(diff))}${unit}`}
            </span>
            어제 대비
        </span>
    );
}

/** 숫자 카드 — 흰 카드에 이름·큰 숫자·어제 대비만. 색 막대 없이 숫자가 먼저 읽히고, 링크가 있으면 오른쪽 위 > 로 누를 수 있음을 알린다 */
function StatCard({
    label,
    value,
    pending = false,
    error,
    onRetry,
    description,
    to,
    unit = '건',
    previous,
}: StatCardProps) {
    return (
        <div
            className={cn(
                'group bg-surface-page border-border-default relative flex flex-col gap-1 rounded-2xl border p-5 transition-colors',
                // 1px 테두리 + 1px 링 — 크기를 바꾸지 않고 2px로 또렷하게
                to && 'hover:border-fg-brand hover:ring-fg-brand hover:ring-1',
            )}
        >
            {/* 카드 전체를 덮는 링크 — 재시도 버튼은 relative로 링크 위에 띄운다 */}
            {to && (
                <Link
                    to={to}
                    aria-label={`${label} 화면으로 이동`}
                    className={cn(
                        'absolute inset-0 rounded-2xl',
                        'focus-visible:ring-border-focus focus-visible:ring-offset-surface-page focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none',
                    )}
                />
            )}
            {/* 누르면 관리 화면으로 간다는 표시 — 움직임 없이 올리면 색만 진해진다 */}
            {to && (
                <ChevronRight
                    aria-hidden
                    className="text-fg-tertiary group-hover:text-fg-primary absolute top-5 right-5 size-5"
                />
            )}
            <span className="text-body-sm text-fg-tertiary">{label}</span>
            <div className="text-title-1 text-fg-primary tabular-nums">
                {pending ? (
                    <>
                        <Skeleton className="h-8 w-20" />
                        <span className="sr-only">불러오는 중…</span>
                    </>
                ) : error ? (
                    <span className="text-semantic-error-strong text-body-sm font-medium">
                        조회 실패
                    </span>
                ) : value == null ? (
                    '—'
                ) : (
                    `${formatNumber(value)}${unit}`
                )}
            </div>
            {!pending && !error && value != null && previous != null ? (
                <Delta value={value} previous={previous} unit={unit} />
            ) : (
                <span className="text-caption text-fg-tertiary">{description}</span>
            )}
            {error && onRetry && (
                <Button size="sm" variant="ghost" className="relative self-start" onClick={onRetry}>
                    다시 시도
                </Button>
            )}
        </div>
    );
}

const grantedOf = (day: DailyStatsDay | undefined) =>
    day === undefined
        ? undefined
        : day.grantedTickets.ATTENDANCE + day.grantedTickets.MISSION + day.grantedTickets.GAME;

/**
 * 관리자 대시보드 지표 요약 — 대시보드 페이지가 조회한 AS01 일별 집계를 요약 카드와 함께 쓴다.
 * 탐지 기록은 지급 차단 확정이 아니므로 상세 링크를 두지 않는다(차단 메뉴의 실연동은 L2).
 * 오늘·어제는 AS01 days의 마지막 두 항목(KST 날짜, 서버 기준)이다
 */
export function AdminStatSummary({ stats }: { stats: UseQueryResult<DailyStats> }) {
    const openEvents = useAdminEvents({ page: 1, size: 1, status: 'OPEN' });

    const days = stats.data?.days ?? [];
    const today = days[days.length - 1];
    const yesterday = days[days.length - 2];
    const todayYmd = today?.date ?? '';
    const totalUserCount = stats.data?.totalUserCount;
    const participationRate =
        today && totalUserCount != null && totalUserCount > 0
            ? `${formatNumber(Math.round((today.activeUserCount / totalUserCount) * 1000) / 10)}%`
            : '계산 불가';

    return (
        <div className="flex flex-col gap-3">
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <StatCard
                    label="진행 중 이벤트"
                    value={openEvents.data?.totalElements}
                    pending={openEvents.isPending}
                    error={openEvents.isError}
                    onRetry={() => void openEvents.refetch()}
                    description="지금 응모를 받는 이벤트"
                    to="/admin/events?status=OPEN"
                />
                <StatCard
                    label="오늘 지급한 응모권"
                    value={grantedOf(today)}
                    previous={grantedOf(yesterday)}
                    unit="장"
                    pending={stats.isPending}
                    error={stats.isError}
                    onRetry={() => void stats.refetch()}
                    description="출석·미션·게임 보상"
                    to={`/admin/tickets?tab=grants&date=${todayYmd}`}
                />
                <StatCard
                    label="오늘 응모에 쓴 응모권"
                    value={today?.usedTickets}
                    previous={yesterday?.usedTickets}
                    unit="장"
                    pending={stats.isPending}
                    error={stats.isError}
                    onRetry={() => void stats.refetch()}
                    description="이벤트 응모로 차감된 응모권(반환 미차감)"
                    to={`/admin/tickets?tab=histories&date=${todayYmd}&operationType=USE`}
                />
                <StatCard
                    label="오늘 어뷰징 탐지 기록"
                    value={today?.blockedCount}
                    previous={yesterday?.blockedCount}
                    pending={stats.isPending}
                    error={stats.isError}
                    onRetry={() => void stats.refetch()}
                    description="탐지 기록 수 — 차단 확정 건수가 아님"
                />
            </div>
            {stats.data && (
                <dl className="text-caption text-fg-tertiary flex flex-wrap gap-x-6 gap-y-1 px-1">
                    <div className="flex gap-1.5">
                        <dt>오늘 응모자</dt>
                        <dd className="text-fg-primary tabular-nums">
                            {formatNumber(today?.entrantCount ?? 0)}명
                        </dd>
                    </div>
                    <div className="flex gap-1.5">
                        <dt>오늘 접수 응모</dt>
                        <dd className="text-fg-primary tabular-nums">
                            {formatNumber(today?.entryCount ?? 0)}건
                        </dd>
                    </div>
                    <div className="flex gap-1.5">
                        <dt>오늘 활동 사용자</dt>
                        <dd className="text-fg-primary tabular-nums">
                            {formatNumber(today?.activeUserCount ?? 0)}명
                        </dd>
                    </div>
                    <div className="flex gap-1.5">
                        <dt>현재 활성 일반 사용자</dt>
                        <dd className="text-fg-primary tabular-nums">
                            {formatNumber(totalUserCount ?? 0)}명
                        </dd>
                    </div>
                    <div className="flex gap-1.5">
                        <dt>참여율(활동 사용자 ÷ 현재 활성 일반 사용자)</dt>
                        <dd className="text-fg-primary tabular-nums">{participationRate}</dd>
                    </div>
                </dl>
            )}
        </div>
    );
}
