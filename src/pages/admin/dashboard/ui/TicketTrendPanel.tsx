import { useReducedMotion } from 'framer-motion';
import { useId, useState } from 'react';
import { createPortal } from 'react-dom';
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

import { LoadingBlock, Skeleton } from '@shared/ui/skeleton';
import { formatNumber } from '@shared/utils/format';

import type { TrendRow } from '../hooks/useTicketTrend';

import { DashboardPanel } from './DashboardPanel';
import { ViewAllLink } from './ViewAllLink';

// 디자인 시스템 차트 규칙 — 현재 값은 chart/line 실선 + 아래로 아주 옅어지는 영역(진한 채움은 눈을 피로하게 했다).
// 비교 값(응모 사용)은 마젠타 옆에서 가라앉는 짙은 회남색 동그란 점선 — 오늘 구간의 마젠타 긴 점선과도 구분된다
const LINE = 'var(--color-chart-line)';
const COMPARE = 'var(--color-fg-secondary)';
const AXIS_TICK = { fill: 'var(--color-chart-axis)', fontSize: 12 };
/** 값 점 — 평소에는 흰 속에 마젠타 테두리, 올린 날짜는 마젠타로 채워진 큰 점(맨 위층이라 선에 가리지 않는다) */
const POINT = { r: 4.5, fill: 'var(--color-surface-page)', strokeWidth: 2.5 };

/** 말풍선 폭과 점에서 떨어진 거리 — 점 옆에 두어 선과 점을 가리지 않는다 */
const BUBBLE_W = 196;
const BUBBLE_GAP = 18;

/** 올린 날짜가 바뀔 때 띠·말풍선이 미끄러지는 시간 */
const MOVE = '240ms cubic-bezier(0.22, 1, 0.36, 1)';

const WEEKDAY = ['일', '월', '화', '수', '목', '금', '토'];
const dayTitle = (ymd: string) => {
    const [y, m, d] = ymd.split('-').map(Number);
    const weekday = WEEKDAY[new Date(Date.UTC(y!, m! - 1, d)).getUTCDay()];
    return `${m}월 ${d}일 ${weekday}요일`;
};
/** 꼬리가 말풍선 위에서 내려오는 높이 — 점과 같은 높이에 꼬리 끝이 오도록 말풍선 위치를 맞춘다 */
const TAIL_Y = 30;

/**
 * 올린 날짜 말풍선 — 날짜, 지급(크게), 응모 사용, 누르면 갈 곳 네 줄만. 출처 비율 같은 세부는 지급 이력 화면에서 본다.
 * 점을 향한 꼬리를 달고, 그림(SVG) 밖 HTML 층에 띄워 선·점 뒤로 숨지 않는다
 */
function DayBubble({
    row,
    isToday,
    tail,
}: {
    row: TrendRow;
    isToday: boolean;
    tail: 'left' | 'right';
}) {
    return (
        <div className="relative">
            {/* 꼬리 — 테두리색 삼각형 위에 흰 삼각형을 1px 안쪽으로 겹쳐 말풍선 테두리와 이어지게 한다 */}
            <span
                aria-hidden
                style={{ top: TAIL_Y - 7 }}
                className={
                    tail === 'left'
                        ? 'border-r-border-default absolute -left-[7px] size-0 border-y-[7px] border-r-[7px] border-y-transparent'
                        : 'border-l-border-default absolute -right-[7px] size-0 border-y-[7px] border-l-[7px] border-y-transparent'
                }
            />
            <span
                aria-hidden
                style={{ top: TAIL_Y - 6 }}
                className={
                    tail === 'left'
                        ? 'border-r-surface-page absolute -left-[5.5px] z-10 size-0 border-y-[6px] border-r-[6px] border-y-transparent'
                        : 'border-l-surface-page absolute -right-[5.5px] z-10 size-0 border-y-[6px] border-l-[6px] border-y-transparent'
                }
            />
            <div className="bg-surface-page border-border-default flex flex-col gap-2 rounded-xl border px-4 py-3 shadow-lg">
                <p className="text-caption text-fg-tertiary flex items-center justify-between">
                    {dayTitle(row.ymd)}
                    {isToday && <span>집계 중</span>}
                </p>
                <p className="text-fg-primary flex items-baseline gap-1.5">
                    <span className="text-body-sm text-fg-secondary">지급</span>
                    <span className="text-xl leading-7 font-bold tabular-nums">
                        {formatNumber(row.granted)}
                    </span>
                    <span className="text-body-sm text-fg-secondary">장</span>
                </p>
                <p className="text-body-sm text-fg-secondary tabular-nums">
                    응모에 사용{' '}
                    <span className="text-fg-primary font-semibold">
                        {formatNumber(row.used)}장
                    </span>
                </p>
                <p className="text-caption text-fg-brand font-semibold">
                    클릭하면 그날 지급 이력 →
                </p>
            </div>
        </div>
    );
}

/**
 * 올린 날짜의 하이라이트 띠(그림 안)와 말풍선(그림 위 HTML 층) — 한 벌만 두어, 날짜가 바뀌면 그 자리로 미끄러지고
 * 나타나고 사라질 때는 옅어진다. 말풍선은 점 오른쪽(오른쪽 끝이면 왼쪽)에 두어 선을 가리지 않는다.
 * 채워지는 점은 맨 위 층인 선의 dot이 맡는다. 좌표는 고정한 y축 범위(0~yTop)와 그림 영역으로 직접 계산한다
 */
function FocusLayer({
    rows,
    index,
    visible,
    yTop,
    animate,
    bandFillId,
    overlay,
}: {
    rows: TrendRow[];
    index: number;
    visible: boolean;
    yTop: number;
    animate: boolean;
    /** 위에서 아래로 옅어지는 띠 채움 그라데이션 id */
    bandFillId: string;
    /** 말풍선을 띄울 HTML 층 — 그림과 같은 크기로 겹쳐 둔다 */
    overlay: HTMLElement | null;
}) {
    const plot = usePlotArea();
    const chartWidth = useChartWidth() ?? 0;
    const chartHeight = useChartHeight() ?? 0;
    const row = rows[index];
    if (!plot || !row) return null;
    const cx = plot.x + (plot.width * index) / Math.max(rows.length - 1, 1);
    const cy = plot.y + plot.height * (1 - row.granted / yTop);
    const flip = cx + BUBBLE_GAP + BUBBLE_W > chartWidth;
    const left = flip ? cx - BUBBLE_GAP - BUBBLE_W : cx + BUBBLE_GAP;
    // 꼬리 끝이 점 높이에 오도록 — 그림 위아래로 넘치면 안쪽으로 밀어 넣는다(꼬리는 그대로 점 쪽)
    const top = Math.max(0, Math.min(cy - TAIL_Y, chartHeight - 140));
    const bandWidth = (plot.width / Math.max(rows.length - 1, 1)) * 0.5;
    const fade = {
        opacity: visible ? 1 : 0,
        transition: animate ? 'opacity 200ms ease-out' : 'none',
    };
    return (
        <>
            <rect
                className="pointer-events-none"
                x={cx - bandWidth / 2}
                y={plot.y}
                width={bandWidth}
                height={plot.height}
                fill={`url(#${bandFillId})`}
                style={{
                    ...fade,
                    transition: animate ? `x ${MOVE}, opacity 200ms ease-out` : 'none',
                }}
            />
            {overlay &&
                createPortal(
                    <div
                        className="pointer-events-none absolute top-0 left-0"
                        style={{
                            width: BUBBLE_W,
                            ...fade,
                            transform: `translate(${left}px, ${top + (visible ? 0 : 6)}px)`,
                            transition: animate
                                ? `transform ${MOVE}, opacity 200ms ease-out`
                                : 'none',
                        }}
                    >
                        <DayBubble
                            row={row}
                            isToday={index === rows.length - 1}
                            tail={flip ? 'right' : 'left'}
                        />
                    </div>,
                    overlay,
                )}
        </>
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
    const [overlay, setOverlay] = useState<HTMLDivElement | null>(null);
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
                // 누르면 바로 이력으로 가므로 클릭 뒤 남는 포커스 테두리는 지운다 — 키보드 이동 때만 그림 둘레에 링
                <figure
                    className="relative h-64 cursor-pointer lg:h-auto lg:min-h-64 lg:flex-1 [&_*:focus]:outline-none [&_.recharts-surface]:cursor-pointer [&_.recharts-wrapper]:cursor-pointer"
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
                                overlay={overlay}
                            />
                        </ComposedChart>
                    </ResponsiveContainer>
                    {/* 말풍선 층 — 그림 위에 겹쳐 선·점보다 항상 앞에 온다 */}
                    <div ref={setOverlay} className="pointer-events-none absolute inset-0 z-10" />
                </figure>
            )}
        </DashboardPanel>
    );
}
