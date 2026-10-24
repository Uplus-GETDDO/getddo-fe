import { useReducedMotion } from 'framer-motion';
import { useId, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Area,
    CartesianGrid,
    ComposedChart,
    Line,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
    useChartHeight,
    useChartWidth,
    usePlotArea,
} from 'recharts';

import { TICKET_SOURCE_TYPE_LABEL } from '@entities/ticket';
import { LoadingBlock, Skeleton } from '@shared/ui/skeleton';
import { formatNumber } from '@shared/utils/format';

import type { TrendRow } from '../hooks/useTicketTrend';

import { TREND_SOURCES } from '../hooks/useTicketTrend';
import { DashboardPanel } from './DashboardPanel';
import { ViewAllLink } from './ViewAllLink';

// 디자인 시스템 차트 규칙 — 현재 값은 chart/line 실선 + 아래로 아주 옅어지는 영역(진한 채움은 눈을 피로하게 했다).
// 비교 값(응모 사용)은 마젠타 옆에서 가라앉는 짙은 회남색 동그란 점선 — 오늘 구간의 마젠타 긴 점선과도 구분된다
const LINE = 'var(--color-chart-line)';
const COMPARE = 'var(--color-fg-secondary)';
const AXIS_TICK = { fill: 'var(--color-chart-axis)', fontSize: 12 };
/** 값 점 — 평소에는 흰 속에 마젠타 테두리, 올린 날짜는 마젠타로 채워진 큰 점(맨 위층이라 선에 가리지 않는다) */
const POINT = { r: 4.5, fill: 'var(--color-surface-page)', strokeWidth: 2.5 };

/** 말풍선 크기 — 점 위에 꼬리를 달아 띄운다 */
const BUBBLE_W = 168;
const BUBBLE_H = 92;
const BUBBLE_GAP = 14;

/** 올린 날짜가 바뀔 때 점·말풍선·사각형이 미끄러지는 시간 */
const MOVE = '220ms cubic-bezier(0.22, 1, 0.36, 1)';

/**
 * 올린 날짜의 하이라이트 띠와 말풍선 — 한 벌만 두어, 날짜가 바뀌면 그 자리로 미끄러지고 나타나고 사라질 때는 옅어지며 살짝 떠오른다.
 * 띠도 여기서 그린다 — 툴팁 커서로 두면 올릴 때 갑자기 생기고 떠날 때 갑자기 사라졌다. 채워지는 점은 맨 위 층인 선의 dot이 맡는다.
 * 좌표는 고정한 y축 범위(0~yTop)와 그림 영역으로 직접 계산한다. 말풍선이 위로 잘리면 점 아래로 뒤집고,
 * 좌우 끝에서는 차트 안으로 밀어 넣되 꼬리는 점을 가리킨다
 */
function FocusLayer({
    rows,
    index,
    visible,
    yTop,
    animate,
    bandFillId,
}: {
    rows: TrendRow[];
    index: number;
    visible: boolean;
    yTop: number;
    animate: boolean;
    /** 위에서 아래로 옅어지는 띠 채움 그라데이션 id */
    bandFillId: string;
}) {
    const plot = usePlotArea();
    const chartWidth = useChartWidth() ?? 0;
    const chartHeight = useChartHeight() ?? 0;
    const row = rows[index];
    if (!plot || !row) return null;
    const cx = plot.x + (plot.width * index) / Math.max(rows.length - 1, 1);
    const cy = plot.y + plot.height * (1 - row.granted / yTop);
    const left = Math.min(Math.max(cx - BUBBLE_W / 2, 0), Math.max(chartWidth - BUBBLE_W, 0));
    const below = cy - BUBBLE_GAP - BUBBLE_H < 0;
    const top = below ? cy + BUBBLE_GAP : cy - BUBBLE_GAP - BUBBLE_H - 6;
    // 나타날 때 점 쪽에서 6px 떠오른다 — 사라질 때는 반대로 가라앉는다
    const lift = visible ? 0 : below ? -6 : 6;
    const bandWidth = (plot.width / Math.max(rows.length - 1, 1)) * 0.5;
    return (
        <g
            className="pointer-events-none"
            style={{
                opacity: visible ? 1 : 0,
                transition: animate ? 'opacity 200ms ease-out' : 'none',
            }}
        >
            <rect
                x={cx - bandWidth / 2}
                y={plot.y}
                width={bandWidth}
                height={plot.height}
                fill={`url(#${bandFillId})`}
                style={{ transition: animate ? `x ${MOVE}` : 'none' }}
            />
            <foreignObject
                x={0}
                y={0}
                width={chartWidth}
                height={chartHeight}
                className="overflow-visible"
            >
                <div
                    className={below ? 'absolute flex flex-col-reverse' : 'absolute flex flex-col'}
                    style={{
                        width: BUBBLE_W,
                        transform: `translate(${left}px, ${top + lift}px)`,
                        transition: animate ? `transform ${MOVE}` : 'none',
                    }}
                >
                    <div className="bg-surface-inverse text-fg-inverse flex w-full flex-col gap-0.5 rounded-xl px-3 py-2 shadow-md">
                        <span className="text-caption text-fg-inverse/80 flex justify-between">
                            {row.ymd}
                            <span className="tabular-nums">사용 {formatNumber(row.used)}장</span>
                        </span>
                        <span className="text-body-bold tabular-nums">
                            지급 {formatNumber(row.granted)}장
                        </span>
                        <span className="text-caption text-fg-inverse/80 tabular-nums">
                            {TREND_SOURCES.map(
                                (source) =>
                                    `${TICKET_SOURCE_TYPE_LABEL[source]} ${formatNumber(row[source])}`,
                            ).join(' · ')}
                        </span>
                        <span className="border-fg-inverse/20 text-fg-inverse mt-1.5 border-t pt-1.5 text-xs font-semibold">
                            클릭해서 그날 지급 이력 보기 ›
                        </span>
                    </div>
                    {/* 꼬리 — 점을 가리키는 작은 삼각형 */}
                    <span
                        style={{
                            marginLeft: cx - left - 6,
                            transition: animate ? `margin-left ${MOVE}` : 'none',
                        }}
                        className={
                            below
                                ? 'border-b-surface-inverse size-0 border-x-[6px] border-b-[6px] border-x-transparent'
                                : 'border-t-surface-inverse size-0 border-x-[6px] border-t-[6px] border-x-transparent'
                        }
                    />
                </div>
            </foreignObject>
        </g>
    );
}

/** 오늘 구간(어제→오늘)은 하루가 끝나지 않았으므로 점선으로 따로 그린다 — 줄어든 게 아니라 집계 중임을 보인다 */
type ChartRow = TrendRow & { past: number | null; today: number | null };

/** 응모권 지급(직선 꺾은선 + 영역)과 응모 사용(점선) 추이 — 보상이 들어오고 쓰이는 흐름을 한 그림으로 본다 */
export function TicketTrendPanel({
    rows,
    isPending,
    isError,
    onRetry,
    className,
}: {
    rows: TrendRow[];
    isPending: boolean;
    isError: boolean;
    onRetry: () => void;
    className?: string;
}) {
    const reduceMotion = useReducedMotion() === true;
    // useId 값의 특수문자는 SVG url(#…) 참조에서 깨질 수 있어 영숫자만 남긴다
    const gradientId = `trend-${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
    const totalGranted = rows.reduce((sum, row) => sum + row.granted, 0);
    const totalUsed = rows.reduce((sum, row) => sum + row.used, 0);
    const useRate = totalGranted > 0 ? Math.round((totalUsed / totalGranted) * 100) : 0;
    const navigate = useNavigate();
    const summary = [
        {
            label: '지급',
            legend: <span className="bg-chart-line h-0.5 w-3 rounded-full" />,
            value: `${formatNumber(totalGranted)}장`,
        },
        {
            label: '응모에 사용',
            legend: <span className="border-fg-secondary w-3 border-t-2 border-dotted" />,
            value: `${formatNumber(totalUsed)}장`,
        },
        { label: '사용률', legend: null, value: `${useRate}%` },
    ];
    // 올린 날짜 — 떠나도 마지막 날짜는 기억해 말풍선이 제자리에서 사라지게 한다
    const [hovered, setHovered] = useState<number | null>(null);
    const [shown, setShown] = useState(0);
    if (hovered != null && hovered !== shown) setShown(hovered);
    // 말풍선 좌표를 직접 계산하려고 y축 범위를 고정한다 — 눈금 4칸, 정수 간격
    const yStep = Math.max(1, Math.ceil(Math.max(0, ...rows.map((row) => row.granted)) / 4));
    const yTop = yStep * 4;
    const last = rows.length - 1;
    const chartRows: ChartRow[] = rows.map((row, index) => ({
        ...row,
        past: index < last ? row.granted : null,
        today: index >= last - 1 ? row.granted : null,
    }));
    // 점(날짜)을 누르면 그날 지급으로 걸러진 전체 이력을 연다
    const openDay = (index: unknown) => {
        const row = rows[Number(index)];
        if (row) void navigate(`/admin/tickets?date=${row.ymd}&operationType=GRANT`);
    };

    return (
        <DashboardPanel
            title="응모권 지급·응모 추이"
            caption={`최근 ${rows.length}일 · 오늘은 지금까지 집계 (가상 시계 기준)`}
            actions={<ViewAllLink to="/admin/tickets?operationType=GRANT" />}
            error={isError}
            onRetry={onRetry}
            className={className}
        >
            {/* 기간 합계 — 세 값을 같은 크기로 나란히. 선 모양 범례가 그래프 선과 짝을 이룬다 */}
            <dl className="divide-border-default flex flex-wrap gap-y-3 divide-x">
                {summary.map(({ label, legend, value }) => (
                    <div key={label} className="flex flex-col gap-1 px-6 first:pl-0">
                        <dt className="text-caption text-fg-tertiary flex items-center gap-1.5">
                            {legend}
                            {label}
                        </dt>
                        <dd className="text-fg-primary text-2xl leading-8 font-bold tracking-tight tabular-nums">
                            {isPending ? <Skeleton className="h-7 w-16" /> : value}
                        </dd>
                    </div>
                ))}
            </dl>
            {isPending ? (
                <LoadingBlock>
                    <Skeleton className="h-64 w-full rounded-xl" />
                </LoadingBlock>
            ) : (
                <figure
                    className="h-64 cursor-pointer lg:h-auto lg:min-h-64 lg:flex-1 [&_.recharts-surface]:cursor-pointer [&_.recharts-wrapper]:cursor-pointer"
                    aria-label={`최근 ${rows.length}일 응모권 지급과 응모 사용 추이`}
                >
                    <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart
                            data={chartRows}
                            margin={{ top: 16, right: 12, bottom: 0, left: -16 }}
                            onClick={(state) => openDay(state.activeTooltipIndex)}
                            onMouseMove={(state) => {
                                const index = state.activeTooltipIndex;
                                setHovered(index == null ? null : Number(index));
                            }}
                            onMouseLeave={() => setHovered(null)}
                            className="cursor-pointer"
                            style={{ cursor: 'pointer' }}
                        >
                            <defs>
                                <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor={LINE} stopOpacity={0.14} />
                                    <stop offset="100%" stopColor={LINE} stopOpacity={0.02} />
                                </linearGradient>
                                <linearGradient
                                    id={`${gradientId}-band`}
                                    x1="0"
                                    y1="0"
                                    x2="0"
                                    y2="1"
                                >
                                    <stop offset="0%" stopColor={LINE} stopOpacity={0.1} />
                                    <stop offset="100%" stopColor={LINE} stopOpacity={0.02} />
                                </linearGradient>
                            </defs>
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
                                ticks={[0, yStep, yStep * 2, yStep * 3, yTop]}
                            />
                            {/* 올린 날짜만 알면 된다 — 툴팁 상자·커서는 그리지 않고 FocusLayer가 띠와 말풍선을 그린다 */}
                            <Tooltip content={() => null} cursor={false} />
                            <Line
                                dataKey="used"
                                type="linear"
                                stroke={COMPARE}
                                strokeWidth={2}
                                strokeDasharray="0 5"
                                strokeLinecap="round"
                                dot={false}
                                activeDot={false}
                                isAnimationActive={!reduceMotion}
                            />
                            {/* 영역 채움과 점은 전체 기간, 선은 지난날(실선)과 오늘 구간(점선)으로 나눠 그린다 */}
                            <Line
                                dataKey="past"
                                type="linear"
                                stroke={LINE}
                                strokeWidth={2.5}
                                dot={false}
                                activeDot={false}
                                isAnimationActive={!reduceMotion}
                            />
                            <Line
                                dataKey="today"
                                type="linear"
                                stroke={LINE}
                                strokeWidth={2.5}
                                strokeDasharray="6 5"
                                dot={false}
                                activeDot={false}
                                isAnimationActive={!reduceMotion}
                            />
                            <Area
                                dataKey="granted"
                                type="linear"
                                stroke="none"
                                fill={`url(#${gradientId})`}
                                dot={false}
                                activeDot={false}
                                isAnimationActive={!reduceMotion}
                            />
                            {/* 점·말풍선 전용 선 — recharts는 선을 영역보다 위에 그리므로, 점을 맨 마지막 선에 달아야 흰 속 점이 선을 가린다 */}
                            <Line
                                dataKey="granted"
                                type="linear"
                                stroke="none"
                                dot={(props: { cx?: number; cy?: number; index?: number }) => {
                                    const active = hovered != null && props.index === hovered;
                                    return (
                                        <circle
                                            key={props.index}
                                            cx={props.cx}
                                            cy={props.cy}
                                            r={active ? 6.5 : POINT.r}
                                            fill={active ? LINE : POINT.fill}
                                            stroke={active ? 'var(--color-surface-page)' : LINE}
                                            strokeWidth={active ? 2 : POINT.strokeWidth}
                                            style={{
                                                transition: reduceMotion
                                                    ? 'none'
                                                    : 'r 180ms ease-out, fill 180ms ease-out',
                                            }}
                                        />
                                    );
                                }}
                                activeDot={false}
                                isAnimationActive={!reduceMotion}
                            />
                            <FocusLayer
                                rows={rows}
                                index={shown}
                                visible={hovered != null}
                                yTop={yTop}
                                animate={!reduceMotion}
                                bandFillId={`${gradientId}-band`}
                            />
                        </ComposedChart>
                    </ResponsiveContainer>
                </figure>
            )}
        </DashboardPanel>
    );
}
