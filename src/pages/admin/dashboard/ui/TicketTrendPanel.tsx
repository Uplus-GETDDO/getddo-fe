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

// 디자인 시스템 차트 규칙 — 현재 값은 chart/line 실선 + 아래로 옅어지는 영역.
// 비교 값(응모 사용)은 마젠타 옆에서 가라앉는 짙은 회남색 동그란 점선 — 오늘 구간의 마젠타 긴 점선과도 구분된다
const LINE = 'var(--color-chart-line)';
const COMPARE = 'var(--color-fg-secondary)';
const AXIS_TICK = { fill: 'var(--color-chart-axis)', fontSize: 12 };
/** 값 점 — 평소에는 흰 속에 마젠타 테두리, 올리면 FocusLayer가 조금 큰 마젠타 점을 겹친다 */
const POINT = { r: 4.5, fill: 'var(--color-surface-page)', stroke: LINE, strokeWidth: 2.5 };

/** 말풍선 크기 — 점 위에 꼬리를 달아 띄운다 */
const BUBBLE_W = 168;
const BUBBLE_H = 92;
const BUBBLE_GAP = 14;

/** 올린 날짜가 바뀔 때 점·말풍선·사각형이 미끄러지는 시간 */
const MOVE = '220ms cubic-bezier(0.22, 1, 0.36, 1)';

/**
 * 올린 점과 말풍선 — 점마다 새로 그리지 않고 한 벌만 두어, 날짜가 바뀌면 그 자리로 미끄러진다.
 * 좌표는 고정한 y축 범위(0~yTop)와 그림 영역으로 직접 계산한다. 말풍선이 위로 잘리면 점 아래로 뒤집고,
 * 좌우 끝에서는 차트 안으로 밀어 넣되 꼬리는 점을 가리킨다
 */
function FocusLayer({
    rows,
    index,
    visible,
    yTop,
    animate,
}: {
    rows: TrendRow[];
    index: number;
    visible: boolean;
    yTop: number;
    animate: boolean;
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
    return (
        <g
            className="pointer-events-none"
            style={{
                opacity: visible ? 1 : 0,
                transition: animate ? 'opacity 160ms ease-out' : 'none',
            }}
        >
            <circle
                cx={cx}
                cy={cy}
                r={6}
                fill={LINE}
                style={{ transition: animate ? `cx ${MOVE}, cy ${MOVE}` : 'none' }}
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
                        transform: `translate(${left}px, ${top}px)`,
                        transition: animate ? `transform ${MOVE}` : 'none',
                    }}
                >
                    <div className="bg-brand-primary text-fg-on-brand flex w-full flex-col gap-0.5 rounded-xl px-3 py-2 shadow-md">
                        <span className="text-caption flex justify-between opacity-80">
                            {row.ymd}
                            <span className="tabular-nums">사용 {formatNumber(row.used)}장</span>
                        </span>
                        <span className="text-body-bold tabular-nums">
                            지급 {formatNumber(row.granted)}장
                        </span>
                        <span className="text-caption tabular-nums opacity-80">
                            {TREND_SOURCES.map(
                                (source) =>
                                    `${TICKET_SOURCE_TYPE_LABEL[source]} ${formatNumber(row[source])}`,
                            ).join(' · ')}
                        </span>
                        <span className="mt-0.5 text-[0.6875rem] opacity-70">
                            눌러서 그날 지급 이력 보기 ›
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
                                ? 'border-b-brand-primary size-0 border-x-[6px] border-b-[6px] border-x-transparent'
                                : 'border-t-brand-primary size-0 border-x-[6px] border-t-[6px] border-x-transparent'
                        }
                    />
                </div>
            </foreignObject>
        </g>
    );
}

/**
 * 올린 날짜 칸 — 점 위아래로 옅은 브랜드색 사각형을 세워 어느 날을 보는지 분명히 한다.
 * 점 간격의 절반 너비로, 모서리 없이 위는 진하고 아래로 옅어진다
 */
function HoverBand({
    count,
    fillId,
    animate,
    points,
}: {
    count: number;
    animate: boolean;
    /** 위에서 아래로 옅어지는 채움 그라데이션 id */
    fillId: string;
    points?: { x: number; y: number }[];
}) {
    const plot = usePlotArea();
    const x = points?.[0]?.x;
    if (!plot || x == null) return null;
    const width = (plot.width / Math.max(count - 1, 1)) * 0.5;
    return (
        <rect
            x={x - width / 2}
            y={plot.y}
            width={width}
            height={plot.height}
            fill={`url(#${fillId})`}
            className="pointer-events-none"
            style={{ transition: animate ? `x ${MOVE}` : 'none' }}
        />
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
    // 점(날짜)을 누르면 그날로 걸러진 지급 이력을 연다
    const openDay = (index: unknown) => {
        const row = rows[Number(index)];
        if (row) void navigate(`/admin/tickets?tab=grants&date=${row.ymd}`);
    };

    return (
        <DashboardPanel
            title="응모권 지급·응모 추이"
            caption={`최근 ${rows.length}일 · 오늘은 지금까지 집계 (가상 시계 기준)`}
            actions={<ViewAllLink to="/admin/tickets?tab=grants" />}
            error={isError}
            onRetry={onRetry}
            className={className}
        >
            {/* 기간 합계 — 세 값을 같은 크기로 나란히. 선 모양 범례가 그래프 선과 짝을 이룬다 */}
            <dl className="divide-border-default flex flex-wrap divide-x">
                {summary.map(({ label, legend, value }) => (
                    <div key={label} className="flex flex-col gap-0.5 px-5 first:pl-0">
                        <dt className="text-caption text-fg-tertiary flex items-center gap-1.5">
                            {legend}
                            {label}
                        </dt>
                        <dd className="text-title-3 text-fg-primary tabular-nums">
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
                    className="h-64 lg:h-auto lg:min-h-64 lg:flex-1"
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
                        >
                            <defs>
                                <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor={LINE} stopOpacity={0.32} />
                                    <stop offset="100%" stopColor={LINE} stopOpacity={0.02} />
                                </linearGradient>
                                <linearGradient
                                    id={`${gradientId}-band`}
                                    x1="0"
                                    y1="0"
                                    x2="0"
                                    y2="1"
                                >
                                    <stop offset="0%" stopColor={LINE} stopOpacity={0.22} />
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
                            {/* 말풍선은 점 위에 직접 그리므로 툴팁 상자는 숨기고 세로 안내선만 둔다 */}
                            <Tooltip
                                content={() => null}
                                cursor={
                                    <HoverBand
                                        count={rows.length}
                                        fillId={`${gradientId}-band`}
                                        animate={!reduceMotion}
                                    />
                                }
                            />
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
                                dot={POINT}
                                activeDot={false}
                                isAnimationActive={!reduceMotion}
                            />
                            <FocusLayer
                                rows={rows}
                                index={shown}
                                visible={hovered != null}
                                yTop={yTop}
                                animate={!reduceMotion}
                            />
                        </ComposedChart>
                    </ResponsiveContainer>
                </figure>
            )}
        </DashboardPanel>
    );
}
