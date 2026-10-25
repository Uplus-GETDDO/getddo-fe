import { X } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';

import type { AdminEventStatus } from '@entities/event';

import { useEventDraws } from '@entities/drawResult';
import { ADMIN_STATUS_META, useAdminEvent } from '@entities/event';
import { badgeVariants } from '@shared/ui/badge';
import { Button } from '@shared/ui/button';
import { ChipTabs } from '@shared/ui/chip-tabs';
import { CardSkeleton, LoadingBlock } from '@shared/ui/skeleton';
import { cn } from '@shared/utils/cn';
import { formatKst } from '@shared/utils/date';

import { DrawRunDetail } from './DrawRunDetail';
import { DRAW_RUN_PAGE_SIZE, DrawRunList } from './DrawRunList';
import { ResultChangesSection } from './ResultChangesSection';

type PanelTab = 'runs' | 'changes';

const TABS: { value: PanelTab; label: string }[] = [
    { value: 'runs', label: '추첨 기록' },
    { value: 'changes', label: '공개 명단 변경 이력' },
];

const FLOW_STEPS = ['자동 추첨', '결과 확인·조정', '당첨자 공개'] as const;

/**
 * 상태별로 관리자가 지금 하는 일 — '실행' 같은 시스템 말 대신 할 일 순서(추첨 → 확인·조정 → 공개)로 안내한다.
 * step은 FLOW_STEPS의 지금 칸, action은 최신 추첨 결과를 여는 버튼 이름(없으면 기다리기만)
 */
const DRAW_FLOW: Partial<
    Record<
        AdminEventStatus,
        { step: number; title: string; hint: string; action?: string; primary?: boolean }
    >
> = {
    CLOSED: {
        step: 0,
        title: '자동 추첨을 기다리는 중이에요.',
        hint: '마감 1분 뒤 자동으로 추첨해요. 끝나면 결과 확인 단계로 넘어가요.',
    },
    DRAW_CONFIRMED: {
        step: 1,
        title: '당첨자를 확인하고 공개해 주세요.',
        hint: '필요하면 당첨 취소·재추첨을 한 뒤 공개해요. 공개 전까지 사용자에게 보이지 않아요.',
        action: '결과 확인하고 공개하기',
        primary: true,
    },
    REDRAWING: {
        step: 1,
        title: '재추첨 결과를 확인해 주세요.',
        hint: '빈 자리를 채운 결과를 확인하고 공개 명단을 갱신해요.',
        action: '재추첨 결과 열기',
        primary: true,
    },
    PUBLISHED: {
        step: 3,
        title: '당첨자 공개를 마쳤어요.',
        hint: '당첨 취소가 필요하면 결과에서 취소하고 빈 자리를 다시 추첨할 수 있어요.',
        action: '공개된 결과 보기',
    },
};

// 이벤트 하나의 추첨 관리 — 진행 단계 안내 + 추첨 기록(AD01)·상세(AD02)·변경 이력(AD07)
export function DrawEventPanel({ eventId, onClose }: { eventId: string; onClose?: () => void }) {
    const {
        data: event,
        isPending: eventPending,
        isError: eventError,
        refetch: refetchEvent,
    } = useAdminEvent(eventId);
    // 사용자가 고르지 않으면 가장 최근 실행을 본다 — AD01 첫 페이지 캐시를 목록과 공유한다
    const latest = useEventDraws(eventId, { page: 1, size: DRAW_RUN_PAGE_SIZE });
    const [chosenId, setChosenId] = useState<string | null>(null);
    const [tab, setTab] = useState<PanelTab>('runs');
    // 실행 상세는 중앙 모달로 연다 — 닫아도 목록의 페이지·선택(chosenId)은 그대로 남는다
    const [detailOpen, setDetailOpen] = useState(false);

    // 이벤트가 바뀌면 부모가 key로 패널을 새로 만들어 선택·페이지·탭이 초기화된다
    const selectedId = chosenId ?? latest.data?.items[0]?.id ?? null;
    const select = (drawId: string) => {
        setChosenId(drawId);
        setDetailOpen(true);
    };

    const status = event ? ADMIN_STATUS_META[event.status] : null;
    const flow = event ? DRAW_FLOW[event.status] : undefined;
    const latestRun = latest.data?.items[0];
    // ADR-022 — 발표 예정 시각·카운트다운은 계약에서 제외됐다. 표시 시각은 최초 자동 추첨 기준이다
    const drawScheduledAt = event?.drawScheduledAt;

    return (
        <div className="flex flex-col gap-6">
            {eventPending && (
                <LoadingBlock>
                    <CardSkeleton rows={2} />
                </LoadingBlock>
            )}
            {eventError && (
                <div className="flex items-center gap-3">
                    <p role="alert" className="text-semantic-error-strong text-body-sm">
                        이벤트 정보를 불러오지 못했습니다. 이벤트 상태를 확인할 때까지 당첨
                        취소·재추첨·공개 반영을 사용할 수 없습니다.
                    </p>
                    <Button size="sm" variant="secondary" onClick={() => void refetchEvent()}>
                        다시 시도
                    </Button>
                </div>
            )}
            {event && status && (
                <section className="bg-surface-page border-border-default flex flex-col gap-4 rounded-2xl border p-5">
                    <div className="flex items-start gap-3">
                        <div className="flex min-w-0 flex-1 flex-col gap-2">
                            <span
                                className={cn(
                                    badgeVariants({ variant: null }),
                                    status.chipClass,
                                    'self-start',
                                )}
                            >
                                {status.label}
                            </span>
                            <h2 className="text-title-3 text-fg-primary break-words">
                                {event.title}
                            </h2>
                            <p className="text-body-sm text-fg-secondary tabular-nums">
                                {drawScheduledAt
                                    ? `최초 자동 추첨 ${formatKst(drawScheduledAt)}`
                                    : '마감 뒤 자동 추첨'}
                            </p>
                        </div>
                        <Button size="sm" variant="secondary" asChild>
                            <Link to={`/admin/events/${event.id}`}>이벤트 상세</Link>
                        </Button>
                        {onClose && (
                            <Button
                                size="icon"
                                variant="ghost"
                                className="size-9 shrink-0"
                                aria-label="추첨 관리 닫기"
                                onClick={onClose}
                            >
                                <X aria-hidden className="size-5" />
                            </Button>
                        )}
                    </div>
                    {/* 관리자가 따라가는 세 단계 — 지금 단계와 그 단계에서 누를 버튼 하나만 둔다 */}
                    {flow ? (
                        <div className="border-border-default flex flex-col gap-4 border-t pt-4">
                            <ol className="grid grid-cols-3 gap-2" aria-label="추첨 진행 단계">
                                {FLOW_STEPS.map((label, index) => {
                                    const state =
                                        index < flow.step
                                            ? 'done'
                                            : index === flow.step
                                              ? 'current'
                                              : 'todo';
                                    return (
                                        <li
                                            key={label}
                                            aria-current={state === 'current' ? 'step' : undefined}
                                            className="flex flex-col gap-1.5"
                                        >
                                            <span
                                                aria-hidden
                                                className={cn(
                                                    'h-1 rounded-full',
                                                    state === 'todo'
                                                        ? 'bg-surface-sunken'
                                                        : 'bg-fg-primary',
                                                )}
                                            />
                                            <span
                                                className={cn(
                                                    'text-caption',
                                                    state === 'current'
                                                        ? 'text-fg-primary font-semibold'
                                                        : 'text-fg-tertiary',
                                                )}
                                            >
                                                {index + 1}. {label}
                                            </span>
                                        </li>
                                    );
                                })}
                            </ol>
                            <div className="flex flex-wrap items-center gap-3">
                                <p className="text-body-sm text-fg-secondary min-w-0 flex-1">
                                    <span className="text-body-sm-bold text-fg-primary">
                                        {flow.title}
                                    </span>{' '}
                                    {flow.hint}
                                </p>
                                {flow.action && latestRun && (
                                    <Button
                                        size="sm"
                                        variant={flow.primary ? 'primary' : 'secondary'}
                                        onClick={() => select(latestRun.id)}
                                    >
                                        {flow.action}
                                    </Button>
                                )}
                            </div>
                        </div>
                    ) : (
                        <p className="text-caption text-fg-tertiary border-border-default border-t pt-4">
                            {event.status === 'CANCELED'
                                ? '취소된 이벤트라 추첨·공개를 할 수 없어요.'
                                : '당첨자가 나오지 않은 이벤트예요. 추첨 기록에서 사유를 확인할 수 있어요.'}
                        </p>
                    )}
                </section>
            )}

            <ChipTabs
                tabs={TABS}
                value={tab}
                onValueChange={setTab}
                label="추첨 관리 구분"
                idPrefix="draw"
            />

            {tab === 'runs' && (
                <div
                    role="tabpanel"
                    id="draw-panel-runs"
                    aria-labelledby="draw-tab-runs"
                    className="flex flex-col gap-6"
                >
                    <DrawRunList eventId={eventId} selectedId={selectedId} onSelect={select} />
                    {selectedId && (
                        <DrawRunDetail
                            key={selectedId}
                            drawId={selectedId}
                            open={detailOpen}
                            onOpenChange={setDetailOpen}
                            eventCanceled={event?.status === 'CANCELED'}
                            eventReady={event != null && !eventError}
                            onRunCreated={select}
                        />
                    )}
                </div>
            )}
            {tab === 'changes' && (
                <div role="tabpanel" id="draw-panel-changes" aria-labelledby="draw-tab-changes">
                    <ResultChangesSection eventId={eventId} />
                </div>
            )}
        </div>
    );
}
