import type { UseQueryResult } from '@tanstack/react-query';

import { ArrowDownRight, ArrowUpRight, ChevronRight, Minus } from 'lucide-react';
import { Link } from 'react-router-dom';

import type { DailyStats, DailyStatsDay } from '@entities/adminStats';

import { useAdminEvents } from '@entities/event';
import { Button } from '@shared/ui/button';
import { Skeleton } from '@shared/ui/skeleton';
import { cn } from '@shared/utils/cn';
import { formatNumber } from '@shared/utils/format';

interface StatCellProps {
    label: string;
    /** 아직 안 오면 —, 조회 실패는 error로 구분해 짧게 표시한다 */
    value?: number;
    /** 초기 조회 중이면 값 자리에 스켈레톤 — 칸 껍데기(제목·설명·링크)는 그대로 둔다 */
    pending?: boolean;
    /** 조회 실패 — 값 자리에 실패 문구를 두고 재시도 버튼을 연다 */
    error?: boolean;
    onRetry?: () => void;
    description: string;
    /** 관리 화면 링크 — 없으면 칸은 조회 전용 표시가 된다 */
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

/**
 * 숫자 칸 — 한 판 안에 칸막이로 나눈 지표 하나. 이름 · 큰 숫자 · (추세선) · 어제 대비.
 * 링크가 있으면 칸 전체가 눌리고 오른쪽 위 > 가 진해진다
 */
function StatCell({
    label,
    value,
    pending = false,
    error,
    onRetry,
    description,
    to,
    unit = '건',
    previous,
}: StatCellProps) {
    return (
        <div
            className={cn(
                'group bg-surface-page relative flex min-w-0 flex-col gap-3 p-6 transition-colors',
                to && 'hover:bg-surface-canvas',
            )}
        >
            {/* 칸 전체를 덮는 링크 — 재시도 버튼은 relative로 링크 위에 띄운다 */}
            {to && (
                <Link
                    to={to}
                    aria-label={`${label} 화면으로 이동`}
                    className="focus-visible:ring-border-focus absolute inset-0 focus-visible:ring-2 focus-visible:outline-none focus-visible:ring-inset"
                />
            )}
            <span className="text-body-sm text-fg-secondary flex items-center justify-between gap-2 font-medium">
                {label}
                {to && (
                    <ChevronRight
                        aria-hidden
                        className="text-fg-tertiary group-hover:text-fg-primary size-4 shrink-0"
                    />
                )}
            </span>
            <div className="flex items-end justify-between gap-3">
                <div className="text-fg-primary text-[2rem] leading-10 font-bold tracking-tight tabular-nums">
                    {pending ? (
                        <>
                            <Skeleton className="h-10 w-24" />
                            <span className="sr-only">불러오는 중…</span>
                        </>
                    ) : error ? (
                        <span className="text-semantic-error-strong text-body-sm font-medium">
                            조회 실패
                        </span>
                    ) : value == null ? (
                        '—'
                    ) : (
                        <>
                            {formatNumber(value)}
                            <span className="text-fg-tertiary ml-1 text-base font-medium">
                                {unit}
                            </span>
                        </>
                    )}
                </div>
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
 * 관리자 대시보드 지표 요약 — 대시보드 페이지가 조회한 AS01 일별 집계를 요약 칸과 함께 쓴다.
 * 세 지표를 카드 대신 한 판에 칸막이로 묶어 숫자가 먼저 읽히게 한다.
 * 어뷰징 탐지는 몇 건이 어제보다 늘었는지가 아니라 '있는지'가 중요해 숫자 칸에서 빼고, 있을 때만 '지금 처리할 일'에 띄운다.
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
    const sub = [
        { label: '오늘 응모자', value: `${formatNumber(today?.entrantCount ?? 0)}명` },
        { label: '오늘 접수 응모', value: `${formatNumber(today?.entryCount ?? 0)}건` },
        { label: '오늘 활동 사용자', value: `${formatNumber(today?.activeUserCount ?? 0)}명` },
        { label: '현재 활성 일반 사용자', value: `${formatNumber(totalUserCount ?? 0)}명` },
        { label: '참여율(활동 사용자 ÷ 현재 활성 일반 사용자)', value: participationRate },
    ];

    return (
        <div className="bg-surface-page border-border-default overflow-hidden rounded-2xl border">
            {/* 칸막이는 1px 틈 사이로 비치는 바탕선 — 줄 수가 바뀌어도 선이 겹치거나 빠지지 않는다 */}
            <div className="bg-border-default grid gap-px sm:grid-cols-3">
                <StatCell
                    label="진행 중 이벤트"
                    value={openEvents.data?.totalElements}
                    pending={openEvents.isPending}
                    error={openEvents.isError}
                    onRetry={() => void openEvents.refetch()}
                    description="지금 응모를 받는 이벤트"
                    to="/admin/events?status=OPEN"
                />
                <StatCell
                    label="오늘 지급한 응모권"
                    value={grantedOf(today)}
                    previous={grantedOf(yesterday)}
                    unit="장"
                    pending={stats.isPending}
                    error={stats.isError}
                    onRetry={() => void stats.refetch()}
                    description="출석·미션·게임 보상"
                    to={today ? `/admin/tickets?date=${todayYmd}&operationType=GRANT` : undefined}
                />
                <StatCell
                    label="오늘 응모에 쓴 응모권"
                    value={today?.usedTickets}
                    previous={yesterday?.usedTickets}
                    unit="장"
                    pending={stats.isPending}
                    error={stats.isError}
                    onRetry={() => void stats.refetch()}
                    description="이벤트 응모로 차감된 응모권(반환 미차감)"
                    to={today ? `/admin/tickets?date=${todayYmd}&operationType=USE` : undefined}
                />
            </div>
            {/* 보조 지표 — 판 아래 띠에 작은 글로. 큰 숫자 넷과 무게를 나눈다 */}
            {stats.data && (
                <dl className="bg-surface-canvas border-border-default flex flex-wrap gap-x-8 gap-y-2 border-t px-6 py-3.5">
                    {sub.map(({ label, value }) => (
                        <div key={label} className="text-caption flex gap-1.5">
                            <dt className="text-fg-tertiary">{label}</dt>
                            <dd className="text-fg-primary font-semibold tabular-nums">{value}</dd>
                        </div>
                    ))}
                </dl>
            )}
        </div>
    );
}
