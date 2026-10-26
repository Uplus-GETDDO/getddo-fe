import { useState } from 'react';

import type { AdminNotification } from '@entities/adminNotification';

import {
    AdminNotificationDetailDrawer,
    AdminNotificationTable,
    MOCK_DELIVERY_STATUS_LABEL,
    useAdminNotifications,
} from '@entities/adminNotification';
import { AdminEventPicker, AdminEventTitle } from '@entities/event';
import { BulkRetryButton, RetryDeliveryDialog } from '@features/retryAdminNotification';
import { ALL, isDateRangeOrdered, orUndefined, PAGE_SIZE } from '@shared/model/filterConstants';
import { Button } from '@shared/ui/button';
import { DateRangeFilter, TextFilter } from '@shared/ui/filter-fields';
import {
    chipValue,
    FilterChips,
    FilterPanel,
    FilterRow,
    rangeValue,
} from '@shared/ui/filter-panel';
import { ListDetailLayout } from '@shared/ui/inspector';
import { PagedResult } from '@shared/ui/paged-result';
import { kstDateStartUtcIso, kstNextDateStartUtcIso } from '@shared/utils/date';

const RANGE_MSG = '시작일이 종료일보다 늦습니다.';

const STATUS_OPTIONS = [
    { value: ALL, label: '전체' },
    ...Object.entries(MOCK_DELIVERY_STATUS_LABEL).map(([value, label]) => ({ value, label })),
];

const EMPTY = {
    userId: '',
    eventId: '',
    jobId: '',
    mockDeliveryStatus: ALL,
    from: '',
    to: '',
};

// AN04·AN05 — 개별 알림 모의 발송 이력과 발송 복구 접수. 기간은 생성 시각 기준 [from, to)
export function DeliveriesTab() {
    const [page, setPage] = useState(1);
    const [draft, setDraft] = useState(EMPTY);
    // 검색 버튼으로 확정한 값만 쿼리에 넘긴다 — 입력마다 요청하지 않는다
    const [applied, setApplied] = useState(EMPTY);
    const [rangeError, setRangeError] = useState(false);
    const hasAppliedFilters = JSON.stringify(applied) !== JSON.stringify(EMPTY);
    const resetFilters = () => {
        setDraft(EMPTY);
        setApplied(EMPTY);
        setRangeError(false);
        setPage(1);
    };
    const [retryTarget, setRetryTarget] = useState<AdminNotification | null>(null);
    const [detailTarget, setDetailTarget] = useState<AdminNotification | null>(null);
    const patch = (value: Partial<typeof EMPTY>) => setDraft((d) => ({ ...d, ...value }));
    // 상태·이벤트는 고르는 즉시 걸고, 글자·날짜만 검색 버튼으로 확정한다
    const applyNow = (value: Partial<typeof EMPTY>) => {
        patch(value);
        setApplied((d) => ({ ...d, ...value }));
        setPage(1);
    };
    const activeCount = [
        applied.userId,
        applied.eventId,
        applied.jobId,
        applied.mockDeliveryStatus !== ALL,
        applied.from || applied.to,
    ].filter(Boolean).length;

    const query = useAdminNotifications({
        page,
        size: PAGE_SIZE,
        userId: applied.userId || undefined,
        eventId: applied.eventId || undefined,
        jobId: applied.jobId || undefined,
        mockDeliveryStatus: orUndefined(applied.mockDeliveryStatus),
        from: applied.from ? kstDateStartUtcIso(applied.from) : undefined,
        to: applied.to ? kstNextDateStartUtcIso(applied.to) : undefined,
    });

    return (
        <div className="flex flex-col gap-6">
            <FilterPanel
                // 범위 오류도 줄 아래에 띄운다 — 알약 창이 닫혀 있으면 창 안의 오류만으로는 왜 검색이 안 되는지 몰랐다
                error={rangeError ? RANGE_MSG : null}
                search={
                    <TextFilter
                        value={draft.userId}
                        onChange={(userId) => patch({ userId })}
                        placeholder="받는 사람 ID로 검색"
                        label="사용자 ID 필터"
                        className="w-full"
                    />
                }
                onSubmit={() => {
                    if (!isDateRangeOrdered(draft.from, draft.to)) {
                        setRangeError(true);
                        return false;
                    }
                    setRangeError(false);
                    setApplied({
                        ...draft,
                        userId: draft.userId.trim(),
                        eventId: draft.eventId.trim(),
                        jobId: draft.jobId.trim(),
                    });
                    setPage(1);
                }}
                onReset={resetFilters}
                activeCount={activeCount}
            >
                <FilterRow
                    label="상태"
                    value={chipValue(STATUS_OPTIONS, applied.mockDeliveryStatus)}
                    onClear={() => applyNow({ mockDeliveryStatus: ALL })}
                >
                    <FilterChips
                        value={draft.mockDeliveryStatus}
                        onChange={(mockDeliveryStatus) => applyNow({ mockDeliveryStatus })}
                        options={STATUS_OPTIONS}
                        label="발송 상태"
                    />
                </FilterRow>
                <FilterRow
                    label="이벤트"
                    value={
                        applied.eventId ? <AdminEventTitle eventId={applied.eventId} /> : undefined
                    }
                    onClear={() => applyNow({ eventId: '' })}
                >
                    <AdminEventPicker
                        eventId={applied.eventId}
                        onChange={(eventId) => applyNow({ eventId })}
                    />
                </FilterRow>
                <FilterRow
                    label="생성일"
                    apply
                    value={rangeValue(applied.from, applied.to)}
                    onClear={() => applyNow({ from: '', to: '' })}
                >
                    <DateRangeFilter
                        name="생성일"
                        from={draft.from}
                        to={draft.to}
                        onFromChange={(from) => patch({ from })}
                        onToChange={(to) => patch({ to })}
                        error={rangeError ? RANGE_MSG : null}
                    />
                </FilterRow>
                <FilterRow
                    label="작업 ID"
                    apply
                    value={applied.jobId ? `${applied.jobId.slice(0, 8)}…` : undefined}
                    onClear={() => applyNow({ jobId: '' })}
                >
                    <TextFilter
                        value={draft.jobId}
                        onChange={(jobId) => patch({ jobId })}
                        placeholder="알림 작업에서 넘어올 때 채워져요"
                        label="작업 ID 필터"
                        className="w-96 max-w-full"
                    />
                </FilterRow>
            </FilterPanel>

            {/* 줄을 고르면 오른쪽 칸에 상세 — 이벤트·추첨 관리와 같은 목록 + 상세 꼴 */}
            <ListDetailLayout
                open={detailTarget !== null}
                detailKey={detailTarget?.id}
                label="발송 상세"
                list={
                    <PagedResult
                        data={query.data}
                        isPending={query.isPending}
                        isError={query.isError}
                        isFetching={query.isFetching}
                        updatedAt={query.dataUpdatedAt}
                        page={page}
                        onPageChange={setPage}
                        toolbar={
                            // 지금 목록에서 복구할 수 있는 실패 건만 — 한 건씩 누르지 않고 한 번에 다시 접수한다
                            <BulkRetryButton
                                kind="delivery"
                                targets={(query.data?.items ?? [])
                                    .filter((item) => item.retryable)
                                    .map((item) => ({
                                        id: item.id,
                                        label: `${item.title} · ${item.userName ?? item.userId}`,
                                    }))}
                            />
                        }
                        emptyText="해당하는 발송 이력이 없습니다."
                        errorText="발송 이력을 불러오지 못했습니다."
                        onRetry={() => void query.refetch()}
                        emptyAction={
                            hasAppliedFilters ? (
                                <Button
                                    size="sm"
                                    variant="ghost"
                                    className="self-start"
                                    onClick={resetFilters}
                                >
                                    검색 조건 초기화
                                </Button>
                            ) : undefined
                        }
                    >
                        {(rows) => (
                            <AdminNotificationTable
                                notifications={rows}
                                onRetry={setRetryTarget}
                                onRowClick={setDetailTarget}
                            />
                        )}
                    </PagedResult>
                }
                detail={
                    <AdminNotificationDetailDrawer
                        notification={detailTarget}
                        open={detailTarget !== null}
                        onOpenChange={(open) => {
                            if (!open) setDetailTarget(null);
                        }}
                        action={(notification, blockReason) =>
                            blockReason === null ? (
                                <Button
                                    className="w-full"
                                    onClick={() => setRetryTarget(notification)}
                                >
                                    발송 복구 재시도
                                </Button>
                            ) : null
                        }
                    />
                }
            />

            <RetryDeliveryDialog
                notification={retryTarget}
                onOpenChange={(open) => {
                    if (!open) setRetryTarget(null);
                }}
            />
        </div>
    );
}
