import { ChevronRight } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';

import { LoadingBlock, Skeleton } from '@shared/ui/skeleton';
import { cn } from '@shared/utils/cn';
import { formatNumber } from '@shared/utils/format';

import type { EventStageKey } from '../hooks/useEventStageCounts';

import { useEventStageCounts } from '../hooks/useEventStageCounts';
import { DashboardPanel } from './DashboardPanel';
import { ViewAllLink } from './ViewAllLink';

/** 단계 색 — 관리자 분포 그래프 계열색(마젠타 한 계열). 손이 가야 하는 단계일수록 진하게 (발표 대기 > 추첨 필요 > 진행 중 > 예정 > 종료) */
const STAGE_DOT: Record<EventStageKey, string> = {
    publish: 'bg-chart-series-1',
    draw: 'bg-chart-series-2',
    open: 'bg-chart-series-3',
    scheduled: 'bg-chart-series-4',
    done: 'bg-chart-series-5',
};
/**
 * 이벤트 운영 단계 분포 — 예정·진행·추첨 필요·발표 대기·종료가 각각 몇 개인지 한 줄 누적 막대로 본다.
 * 도넛은 칸끼리 크기 비교가 어려워, 같은 길이 위에 비율대로 나눈 막대와 아래 숫자 목록으로 바꿨다.
 * 막대 칸이나 목록 줄에 올리면 서로 같은 단계가 함께 진해지고, 누르면 그 단계의 관리 화면이 열린다
 */
export function EventStagePanel() {
    const { stages, isPending, isError, refetch } = useEventStageCounts();
    const [hovered, setHovered] = useState<number | null>(null);
    const total = stages.reduce((sum, stage) => sum + stage.count, 0);
    const dim = (index: number) => hovered != null && index !== hovered;

    return (
        <DashboardPanel
            title="이벤트 운영 단계"
            caption="전체 이벤트를 다음에 할 일 기준으로 묶었어요"
            actions={<ViewAllLink to="/admin/events" />}
            error={isError}
            onRetry={refetch}
        >
            {isPending ? (
                <LoadingBlock>
                    <Skeleton className="h-3.5 w-full rounded-full" />
                </LoadingBlock>
            ) : total === 0 ? (
                <p className="text-body-sm text-fg-tertiary py-10 text-center">
                    등록된 이벤트가 없습니다.
                </p>
            ) : (
                <div className="flex flex-1 flex-col gap-4">
                    <p className="flex items-baseline gap-1.5">
                        <span className="text-fg-primary text-[2rem] leading-10 font-bold tracking-tight tabular-nums">
                            {formatNumber(total)}
                        </span>
                        <span className="text-body-sm text-fg-tertiary">전체 이벤트</span>
                    </p>
                    <figure
                        aria-label="운영 단계별 이벤트 수 누적 막대"
                        className="flex h-3.5 gap-0.5 overflow-hidden rounded-full"
                    >
                        {stages.map((stage, index) =>
                            stage.count === 0 ? null : (
                                <span
                                    key={stage.key}
                                    aria-hidden
                                    onMouseEnter={() => setHovered(index)}
                                    onMouseLeave={() => setHovered(null)}
                                    style={{ flexGrow: stage.count }}
                                    className={cn(
                                        'basis-0 transition-opacity duration-200',
                                        STAGE_DOT[stage.key],
                                        dim(index) && 'opacity-30',
                                    )}
                                />
                            ),
                        )}
                    </figure>
                    <ul className="flex w-full flex-col">
                        {stages.map((stage, index) => (
                            <li
                                key={stage.key}
                                className="border-border-default border-t first:border-t-0"
                            >
                                <Link
                                    to={stage.to}
                                    onMouseEnter={() => setHovered(index)}
                                    onMouseLeave={() => setHovered(null)}
                                    className={cn(
                                        'hover:bg-surface-sunken focus-visible:ring-border-focus -mx-2 flex items-center gap-2.5 rounded-lg px-2 py-2.5 transition-colors focus-visible:ring-2 focus-visible:outline-none',
                                        index === hovered && 'bg-surface-sunken',
                                    )}
                                >
                                    <span
                                        className={cn(
                                            'size-2.5 shrink-0 rounded-sm',
                                            STAGE_DOT[stage.key],
                                        )}
                                    />
                                    <span className="flex min-w-0 flex-col">
                                        <span className="text-body-sm-bold text-fg-primary">
                                            {stage.label}
                                        </span>
                                        <span className="text-caption text-fg-tertiary truncate">
                                            {stage.hint}
                                        </span>
                                    </span>
                                    <span className="text-fg-primary ml-auto text-lg font-bold tabular-nums">
                                        {formatNumber(stage.count)}
                                    </span>
                                    <ChevronRight
                                        aria-hidden
                                        className="text-fg-tertiary size-4 shrink-0"
                                    />
                                </Link>
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </DashboardPanel>
    );
}
