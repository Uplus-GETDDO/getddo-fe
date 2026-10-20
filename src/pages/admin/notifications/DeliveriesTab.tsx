import { useState } from 'react';

import type { AdminNotification } from '@entities/adminNotification';

import {
    AdminNotificationDetailDrawer,
    AdminNotificationTable,
    MOCK_DELIVERY_STATUS_LABEL,
    useAdminNotifications,
} from '@entities/adminNotification';
import { RetryDeliveryDialog } from '@features/retryAdminNotification';
import { ALL, isDateRangeOrdered, orUndefined, PAGE_SIZE } from '@shared/model/filterConstants';
import { Button } from '@shared/ui/button';
import { DateRangeFilter, OptionFilter, TextFilter } from '@shared/ui/filter-fields';
import { PagedResult } from '@shared/ui/paged-result';
import { kstDateStartUtcIso, kstNextDateStartUtcIso } from '@shared/utils/date';

const STATUS_OPTIONS = [
    { value: ALL, label: '전체 발송 상태' },
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
    const hasPendingDraft = JSON.stringify(draft) !== JSON.stringify(applied);
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
            <form
                className="flex flex-wrap items-center gap-2"
                onSubmit={(e) => {
                    e.preventDefault();
                    if (!isDateRangeOrdered(draft.from, draft.to)) {
                        setRangeError(true);
                        return;
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
            >
                <OptionFilter
                    value={draft.mockDeliveryStatus}
                    onChange={(mockDeliveryStatus) => patch({ mockDeliveryStatus })}
                    options={STATUS_OPTIONS}
                    label="발송 상태 필터"
                    className="w-40"
                />
                <TextFilter
                    value={draft.userId}
                    onChange={(userId) => patch({ userId })}
                    placeholder="사용자 ID"
                    label="사용자 ID 필터"
                />
                <TextFilter
                    value={draft.eventId}
                    onChange={(eventId) => patch({ eventId })}
                    placeholder="이벤트 ID"
                    label="이벤트 ID 필터"
                />
                <TextFilter
                    value={draft.jobId}
                    onChange={(jobId) => patch({ jobId })}
                    placeholder="작업 ID"
                    label="작업 ID 필터"
                />
                <DateRangeFilter
                    from={draft.from}
                    to={draft.to}
                    onFromChange={(from) => patch({ from })}
                    onToChange={(to) => patch({ to })}
                    basis="생성일"
                    error={rangeError ? '시작일이 종료일보다 늦습니다.' : null}
                />
                <Button type="submit" variant="secondary">
                    검색
                </Button>
                <Button type="button" variant="ghost" onClick={resetFilters}>
                    초기화
                </Button>
                {hasPendingDraft && (
                    <p className="text-fg-tertiary text-caption basis-full">
                        변경한 조건은 검색을 눌러야 적용됩니다.
                    </p>
                )}
            </form>

            <PagedResult
                data={query.data}
                isPending={query.isPending}
                isError={query.isError}
                isFetching={query.isFetching}
                updatedAt={query.dataUpdatedAt}
                page={page}
                onPageChange={setPage}
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

            <AdminNotificationDetailDrawer
                notification={detailTarget}
                open={detailTarget !== null}
                onOpenChange={(open) => {
                    if (!open) setDetailTarget(null);
                }}
                action={(notification, blockReason) => (
                    <div className="mt-2 flex flex-col gap-1">
                        <Button
                            variant="secondary"
                            disabled={blockReason !== null}
                            aria-describedby={
                                blockReason !== null ? 'delivery-retry-disabled-reason' : undefined
                            }
                            onClick={() => setRetryTarget(notification)}
                        >
                            발송 복구 재시도
                        </Button>
                        {blockReason !== null && (
                            <p
                                id="delivery-retry-disabled-reason"
                                className="text-fg-tertiary text-caption"
                            >
                                {blockReason}
                            </p>
                        )}
                    </div>
                )}
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
