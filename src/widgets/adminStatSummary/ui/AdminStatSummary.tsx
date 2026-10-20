import { ArrowDownRight, ArrowUpRight, ChevronRight, Minus } from 'lucide-react';
import { Link } from 'react-router-dom';

import { useAdminEvents } from '@entities/event';
import { useAdminTicketGrantUserCounts } from '@entities/ticket';
import { useAdminUserCount } from '@entities/user';
import { useVirtualClock } from '@shared/model/virtualClock';
import { Button } from '@shared/ui/button';
import { Skeleton } from '@shared/ui/skeleton';
import { cn } from '@shared/utils/cn';
import { recentKstDays } from '@shared/utils/date';
import { formatNumber } from '@shared/utils/format';

interface StatCardProps {
    label: string;
    /** 아직 안 오면 —, 조회 실패는 error로 구분해 짧게 표시한다 */
    value?: number;
    /** 초기 조회 중이면 값 자리에 스켈레톤 — 카드 껍데기(제목·설명·링크)는 그대로 둔다 */
    pending?: boolean;
    /** 조회 실패로 보여줄 값이 없음 — 값 자리에 실패 문구를 두고 재시도 버튼을 연다. 이전 값이 있으면 넘기지 않는다 */
    error?: boolean;
    onRetry?: () => void;
    description: string;
    /** 누르면 열 관리 화면 — 이어질 화면이 없으면 생략하고 카드는 읽기 전용이 된다 */
    to?: string;
    /** 값 뒤 단위 — 이벤트는 건, 참여율은 % */
    unit?: string;
    /** 어제와 비교할 때의 단위 — 참여율은 %p */
    deltaUnit?: string;
    /** 큰 숫자 옆에 작게 붙이는 근거 — 예: 102 / 222명 */
    sub?: string;
    /** 어제 같은 지표 — 있으면 설명 대신 어제보다 늘었는지·줄었는지 적는다 */
    previous?: number;
}

/** 어제 같은 시각까지와 비교 — 늘고 준 것이 좋고 나쁨을 뜻하지 않으므로 색 대신 화살표로만 구분한다 */
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
            어제 이 시각 대비
        </span>
    );
}

/** 숫자 카드 — 흰 카드에 이름·큰 숫자·어제 비교만. 색 막대 없이 숫자가 먼저 읽히고, 오른쪽 위 > 로 누를 수 있음을 알린다 */
function StatCard({
    label,
    value,
    pending = false,
    error,
    onRetry,
    description,
    to,
    unit = '건',
    deltaUnit = unit,
    sub,
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
            {to && (
                <>
                    {/* 카드 전체를 덮는 링크 — 재시도 버튼은 relative로 링크 위에 띄운다 */}
                    <Link
                        to={to}
                        aria-label={`${label} 화면으로 이동`}
                        className={cn(
                            'absolute inset-0 rounded-2xl',
                            'focus-visible:ring-border-focus focus-visible:ring-offset-surface-page focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none',
                        )}
                    />
                    {/* 누르면 관리 화면으로 간다는 표시 — 움직임 없이 올리면 색만 진해진다 */}
                    <ChevronRight
                        aria-hidden
                        className="text-fg-tertiary group-hover:text-fg-primary absolute top-5 right-5 size-5"
                    />
                </>
            )}
            {/* 오른쪽 위 > 자리를 비워 이름이 닿지 않게 한다 */}
            <span className={cn('text-body-sm text-fg-tertiary', to && 'pr-6')}>{label}</span>
            <div className="text-title-1 text-fg-primary flex items-baseline gap-2 tabular-nums">
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
                    <>
                        {`${formatNumber(value)}${unit}`}
                        {sub && (
                            <span className="text-caption text-fg-tertiary font-normal">{sub}</span>
                        )}
                    </>
                )}
            </div>
            {!pending && !error && value != null && previous != null ? (
                <Delta value={value} previous={previous} unit={deltaUnit} />
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

const DAY_MS = 24 * 60 * 60 * 1000;
const COMPARE_STEP_MS = 10 * 60 * 1000;

/** 참여율(%) — 분모가 없거나 0이면 계산하지 않는다 */
const rate = (users: number | undefined, total: number | undefined) =>
    users == null || !total ? undefined : Math.round((users / total) * 100);

const PARTICIPATION = [
    { source: 'ATTENDANCE', label: '오늘 출석 참여율', description: '출석 보상을 받은 사용자' },
    { source: 'MISSION', label: '오늘 설문·퀴즈 참여율', description: '설문·퀴즈를 완료한 사용자' },
    { source: 'GAME', label: '오늘 게임 참여율', description: '게임 보상을 받은 사용자' },
] as const;

/**
 * 관리자 대시보드 지표 요약 — 진행 중 이벤트와 출석·미션·게임 참여율을 모아 각 관리 화면으로 이어준다.
 * 참여율 = 그날 보상을 받은 사용자 수 ÷ 활성 일반 사용자 수. 오늘·어제는 가상 시계 기준 KST 날짜다
 */
export function AdminStatSummary() {
    const now = useVirtualClock().now();
    const days = recentKstDays(now, 2);
    const [yesterday, today] = days.map(({ from, to }) => ({ from, to }));
    // 오늘은 하루가 덜 끝났으므로 어제도 같은 시각까지만 센다. 쿼리 키가 매 렌더 바뀌지 않게 10분 단위로 내린다
    const sameTimeYesterday = yesterday && {
        from: yesterday.from,
        to: new Date(
            Math.floor((now.getTime() - DAY_MS) / COMPARE_STEP_MS) * COMPARE_STEP_MS,
        ).toISOString(),
    };
    // 카드를 누르면 오늘 조건이 걸린 채 목록이 열린다
    const todayYmd = days[1]?.ymd ?? '';

    const openEvents = useAdminEvents({ page: 1, size: 1, status: 'OPEN' });
    // 참여율의 분모 — 응모할 수 있는 활성 일반 사용자 수
    const activeUsers = useAdminUserCount({ role: 'USER', status: 'ACTIVE' });
    // 출처마다 [어제, 오늘] 순서로 받는다
    const participants = useAdminTicketGrantUserCounts(
        PARTICIPATION.flatMap(({ source }) => [
            { ...sameTimeYesterday, sourceType: source },
            { ...today, sourceType: source },
        ]),
    );
    const total = activeUsers.data;

    return (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
                label="진행 중 이벤트"
                value={openEvents.data?.totalElements}
                pending={openEvents.isPending}
                error={openEvents.isError && !openEvents.data}
                onRetry={() => void openEvents.refetch()}
                description="지금 응모를 받는 이벤트"
                to="/admin/events?status=OPEN"
            />
            {PARTICIPATION.map(({ source, label, description }, index) => {
                const before = participants.counts[index * 2];
                const current = participants.counts[index * 2 + 1];
                const value = rate(current?.users, total);
                const hasValue = value !== undefined;
                return (
                    <StatCard
                        key={source}
                        label={label}
                        value={value}
                        unit="%"
                        deltaUnit="%p"
                        previous={rate(before?.users, total)}
                        sub={
                            current && total
                                ? `${formatNumber(current.users)}${current.capped ? '+' : ''} / ${formatNumber(total)}명`
                                : undefined
                        }
                        pending={participants.isPending || activeUsers.isPending}
                        error={(participants.isError || activeUsers.isError) && !hasValue}
                        onRetry={() => {
                            participants.refetch();
                            void activeUsers.refetch();
                        }}
                        description={description}
                        to={`/admin/tickets?tab=grants&date=${todayYmd}&sourceType=${source}`}
                    />
                );
            })}
        </div>
    );
}
