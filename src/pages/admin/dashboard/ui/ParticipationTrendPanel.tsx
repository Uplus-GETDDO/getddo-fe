import { useReducedMotion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
    CartesianGrid,
    ComposedChart,
    Line,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from 'recharts';

import { formatNumber } from '@shared/lib/format';
import { cn } from '@shared/lib/utils';
import { LoadingBlock, Skeleton } from '@shared/ui/skeleton';

import type { ParticipationDay, ParticipationSource } from '../model/useParticipationTrend';

import { PARTICIPATION_SOURCES } from '../model/useParticipationTrend';
import { DashboardPanel } from './DashboardPanel';
import { ViewAllLink } from './ViewAllLink';

/** 활동별 선 색 — 가장 많이 쓰는 출석을 브랜드 색으로, 나머지는 같은 마젠타 계열의 진한·옅은 색 */
const LINE: Record<ParticipationSource, string> = {
    ATTENDANCE: 'var(--color-brand-primary)',
    MISSION: 'var(--color-chart-series-1)',
    GAME: 'var(--color-chart-series-3)',
};
const LEGEND: Record<ParticipationSource, string> = {
    ATTENDANCE: 'bg-brand-primary',
    MISSION: 'bg-chart-series-1',
    GAME: 'bg-chart-series-3',
};
const AXIS_TICK = { fill: 'var(--color-chart-axis)', fontSize: 12 };

/** 오늘 구간(어제→오늘)은 하루가 끝나지 않았으므로 점선으로 따로 그린다 — 줄어든 게 아니라 집계 중임을 보인다 */
const pastKey = (source: ParticipationSource) => `${source}_past`;
const todayKey = (source: ParticipationSource) => `${source}_today`;

/** 말풍선 — 진한 바탕에 흰 글자. 올린 날의 활동별 참여율과 사람 수를 한 번에 본다 */
function TrendTooltip({
    active,
    label,
    rows,
    total,
}: {
    active?: boolean;
    label?: unknown;
    rows: ParticipationDay[];
    total?: number;
}) {
    const index = rows.findIndex((row) => row.label === label);
    const row = rows[index];
    if (!active || !row) return null;
    const isToday = index === rows.length - 1;
    return (
        <div className="bg-surface-inverse text-fg-inverse flex min-w-44 flex-col gap-1.5 rounded-xl px-3 py-2.5 shadow-md">
            <span className="text-caption font-semibold">
                {row.ymd}
                {isToday && ' · 지금까지'}
            </span>
            <ul className="flex flex-col gap-1">
                {PARTICIPATION_SOURCES.map(({ source, label: name }) => {
                    const users = row.users[source];
                    return (
                        <li key={source} className="text-caption flex items-center gap-2">
                            <span className={cn('size-2 shrink-0 rounded-full', LEGEND[source])} />
                            {name}
                            <span className="text-body-sm-bold ml-auto tabular-nums">
                                {row.rates[source] ?? '—'}%
                            </span>
                            <span className="w-14 text-right tabular-nums">
                                {users ? `${formatNumber(users.users)}명` : ''}
                            </span>
                        </li>
                    );
                })}
            </ul>
            {total !== undefined && (
                <span className="text-caption border-surface-inverse-muted border-t pt-1.5">
                    활성 사용자 {formatNumber(total)}명 기준 · 눌러서 그날 지급 이력 보기
                </span>
            )}
        </div>
    );
}

/**
 * 활동 참여율 추이 — 출석·설문/퀴즈·게임에 하루 동안 참여한 사용자 비율을 최근 7일 꺾은선으로 비교한다.
 * 점을 올리면 그날 활동별 비율과 사람 수가 뜨고, 누르면 그날 지급 이력이 열린다
 */
export function ParticipationTrendPanel({
    rows,
    total,
    isPending,
    isError,
    hasData,
    onRetry,
    className,
}: {
    rows: ParticipationDay[];
    total?: number;
    isPending: boolean;
    isError: boolean;
    hasData: boolean;
    onRetry: () => void;
    className?: string;
}) {
    const reduceMotion = useReducedMotion() === true;
    const navigate = useNavigate();
    const last = rows.length - 1;
    const today = rows[last];

    // 활동별 7일 평균 — 오늘은 하루가 끝나지 않아 뺀다
    const average = (source: ParticipationSource) => {
        const values = rows
            .slice(0, last)
            .map((row) => row.rates[source])
            .filter((rate) => rate !== null);
        return values.length
            ? Math.round(values.reduce((sum, rate) => sum + rate, 0) / values.length)
            : null;
    };
    const chartRows = rows.map((row, index) => ({
        label: row.label,
        ...Object.fromEntries(
            PARTICIPATION_SOURCES.flatMap(({ source }) => [
                [pastKey(source), index < last ? row.rates[source] : null],
                [todayKey(source), index >= last - 1 ? row.rates[source] : null],
            ]),
        ),
    }));
    // y축 위끝 — 가장 높은 비율을 10% 단위로 올린다
    const peak = Math.max(
        10,
        ...rows.flatMap((row) => PARTICIPATION_SOURCES.map(({ source }) => row.rates[source] ?? 0)),
    );
    const yTop = Math.min(100, Math.ceil(peak / 10) * 10);
    // 눈금은 고른 간격으로 — 50%까지는 10%씩, 그 위는 20%씩
    const yStep = yTop <= 50 ? 10 : 20;
    const yTicks = Array.from({ length: Math.floor(yTop / yStep) + 1 }, (_, i) => i * yStep);
    const openDay = (index: unknown) => {
        const row = rows[Number(index)];
        if (row) void navigate(`/admin/tickets?tab=grants&date=${row.ymd}`);
    };

    return (
        <DashboardPanel
            title="활동 참여율 추이"
            caption={`최근 ${rows.length}일 · 그날 보상을 받은 사용자 비율 · 오늘은 지금까지 집계`}
            actions={<ViewAllLink to="/admin/tickets?tab=grants" />}
            error={isError}
            hasData={hasData}
            onRetry={onRetry}
            className={className}
        >
            {/* 활동별 오늘 참여율 — 선 색 범례를 겸한다. 작은 글씨는 지난 6일 평균 */}
            <dl className="divide-border-default flex flex-wrap divide-x">
                {PARTICIPATION_SOURCES.map(({ source, label }) => {
                    const avg = average(source);
                    return (
                        <div key={source} className="flex flex-col gap-0.5 px-5 first:pl-0">
                            <dt className="text-caption text-fg-tertiary flex items-center gap-1.5">
                                <span className={cn('h-0.5 w-3 rounded-full', LEGEND[source])} />
                                {label}
                            </dt>
                            <dd className="text-title-3 text-fg-primary flex items-baseline gap-1.5 tabular-nums">
                                {isPending ? (
                                    <Skeleton className="h-7 w-16" />
                                ) : (
                                    <>
                                        {today?.rates[source] ?? '—'}%
                                        {avg !== null && (
                                            <span className="text-caption text-fg-tertiary font-normal">
                                                평균 {avg}%
                                            </span>
                                        )}
                                    </>
                                )}
                            </dd>
                        </div>
                    );
                })}
            </dl>
            {isPending ? (
                <LoadingBlock>
                    <Skeleton className="h-64 w-full rounded-xl" />
                </LoadingBlock>
            ) : (
                <figure
                    className="h-64 lg:h-auto lg:min-h-64 lg:flex-1"
                    aria-label={`최근 ${rows.length}일 출석·설문/퀴즈·게임 참여율 추이`}
                >
                    <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart
                            data={chartRows}
                            margin={{ top: 16, right: 12, bottom: 0, left: -16 }}
                            onClick={(state) => openDay(state.activeTooltipIndex)}
                            className="cursor-pointer"
                        >
                            {/* 가로 격자만 — 세로선이 점을 관통하지 않게 */}
                            <CartesianGrid vertical={false} stroke="var(--color-chart-grid)" />
                            <XAxis
                                dataKey="label"
                                tickLine={false}
                                axisLine={false}
                                tick={AXIS_TICK}
                                tickMargin={10}
                                interval="preserveStartEnd"
                            />
                            <YAxis
                                allowDecimals={false}
                                tickLine={false}
                                axisLine={false}
                                tick={AXIS_TICK}
                                width={48}
                                domain={[0, yTop]}
                                ticks={yTicks}
                                tickFormatter={(value: number) => `${value}%`}
                            />
                            <Tooltip
                                cursor={{
                                    stroke: 'var(--color-border-strong)',
                                    strokeDasharray: '4 4',
                                }}
                                content={({ active, label }) => (
                                    <TrendTooltip
                                        active={active}
                                        label={label}
                                        rows={rows}
                                        total={total}
                                    />
                                )}
                            />
                            {/* 평소 점은 흰 속에 선 색 테두리, 올리면 recharts가 속이 찬 점을 평소 점보다 위층에 그린다 */}
                            {PARTICIPATION_SOURCES.flatMap(({ source }) => {
                                const dot = {
                                    r: 3.5,
                                    fill: 'var(--color-surface-page)',
                                    stroke: LINE[source],
                                    strokeWidth: 2,
                                };
                                const activeDot = {
                                    r: 5.5,
                                    fill: LINE[source],
                                    stroke: 'var(--color-surface-page)',
                                    strokeWidth: 2,
                                };
                                return [
                                    <Line
                                        key={pastKey(source)}
                                        dataKey={pastKey(source)}
                                        type="linear"
                                        stroke={LINE[source]}
                                        strokeWidth={2.5}
                                        dot={dot}
                                        activeDot={activeDot}
                                        isAnimationActive={!reduceMotion}
                                    />,
                                    <Line
                                        key={todayKey(source)}
                                        dataKey={todayKey(source)}
                                        type="linear"
                                        stroke={LINE[source]}
                                        strokeWidth={2.5}
                                        strokeDasharray="6 5"
                                        dot={dot}
                                        activeDot={activeDot}
                                        isAnimationActive={!reduceMotion}
                                    />,
                                ];
                            })}
                        </ComposedChart>
                    </ResponsiveContainer>
                </figure>
            )}
        </DashboardPanel>
    );
}
