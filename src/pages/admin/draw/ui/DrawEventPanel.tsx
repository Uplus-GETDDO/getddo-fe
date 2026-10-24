import { X } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';

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
    { value: 'runs', label: '추첨 실행' },
    { value: 'changes', label: '공개 명단 변경 이력' },
];

// 이벤트 하나의 추첨 관리 — 실행 목록(AD01)·상세(AD02)·변경 이력(AD07)
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
    const awaitingFirstPublication = event?.status === 'DRAW_CONFIRMED';
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
                    {/* 지금 할 일 — 발표 대기면 최신 실행을 열어 공개하도록 바로 이끈다 */}
                    {awaitingFirstPublication ? (
                        <div className="border-border-brand-subtle bg-brand-soft flex flex-wrap items-center gap-3 rounded-xl border px-4 py-3">
                            <p className="text-body-sm text-fg-primary min-w-0 flex-1">
                                <span className="text-body-sm-bold">당첨자 공개가 필요해요.</span>{' '}
                                최신 실행에서 결과를 확인한 뒤 공개해 주세요. 공개 전까지 사용자에게
                                보이지 않아요.
                            </p>
                            {latest.data?.items[0] && (
                                <Button size="sm" onClick={() => select(latest.data.items[0]!.id)}>
                                    최신 실행 열기
                                </Button>
                            )}
                        </div>
                    ) : (
                        <p className="text-caption text-fg-tertiary">
                            마감 1분 뒤부터 자동 추첨 대상이 되고, 당첨자 공개는 명단을 확인한 뒤
                            직접 요청해요.
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
