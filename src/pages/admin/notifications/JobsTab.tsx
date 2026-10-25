import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import type { NotificationJob } from '@entities/adminNotification';

import {
    NOTIFICATION_JOB_STATUS_LABEL,
    NOTIFICATION_TYPE_LABEL,
    NotificationJobDetailDrawer,
    NotificationJobTable,
    useAdminNotificationJobs,
} from '@entities/adminNotification';
import { AdminEventPicker, AdminEventTitle } from '@entities/event';
import { BulkRetryButton, RetryJobDialog } from '@features/retryAdminNotification';
import { ALL, isDateRangeOrdered, orUndefined, PAGE_SIZE } from '@shared/model/filterConstants';
import { Button } from '@shared/ui/button';
import { DateRangeFilter } from '@shared/ui/filter-fields';
import {
    chipValue,
    FilterChips,
    FilterPanel,
    FilterRow,
    rangeValue,
} from '@shared/ui/filter-panel';
import { PagedResult } from '@shared/ui/paged-result';
import { formatKst, kstDateStartUtcIso, kstNextDateStartUtcIso } from '@shared/utils/date';

const STATUS_OPTIONS = [
    { value: ALL, label: '전체' },
    ...Object.entries(NOTIFICATION_JOB_STATUS_LABEL).map(([value, label]) => ({ value, label })),
];

const TYPE_OPTIONS = [
    { value: ALL, label: '전체' },
    ...Object.entries(NOTIFICATION_TYPE_LABEL).map(([value, label]) => ({ value, label })),
];

const EMPTY = {
    status: ALL,
    notificationType: ALL,
    eventId: '',
    from: '',
    to: '',
};

// 대시보드 패널이 ?status=…로 들어오는 값 — 알려진 작업 상태만 받아들인다
const asJobStatus = (value: string | null) =>
    value !== null && value in NOTIFICATION_JOB_STATUS_LABEL ? value : null;

// AN01~AN03 — 알림 생성 작업 목록·상세·복구 접수. 기간은 생성 시각(createdAt) 기준 [from, to)
export function JobsTab() {
    const [searchParams, setSearchParams] = useSearchParams();
    const statusParam = asJobStatus(searchParams.get('status'));
    const [page, setPage] = useState(1);
    const [draft, setDraft] = useState(() => ({ ...EMPTY, status: statusParam ?? ALL }));
    // 검색 버튼으로 확정한 값만 쿼리에 넘긴다 — 입력마다 요청하지 않는다
    const [applied, setApplied] = useState(() => ({ ...EMPTY, status: statusParam ?? ALL }));

    // 탭이 유지된 채 URL의 status가 바뀌면(대시보드 재진입 등) 필터에 반영한다 — 렌더 중 비교 패턴
    const [appliedStatusParam, setAppliedStatusParam] = useState(statusParam);
    if (statusParam !== appliedStatusParam) {
        setAppliedStatusParam(statusParam);
        const nextStatus = statusParam ?? ALL;
        setDraft((d) => ({ ...d, status: nextStatus }));
        setApplied((a) => ({ ...a, status: nextStatus }));
        setPage(1);
    }
    const [rangeError, setRangeError] = useState(false);
    const hasAppliedFilters = JSON.stringify(applied) !== JSON.stringify(EMPTY);
    const resetFilters = () => {
        setDraft(EMPTY);
        setApplied(EMPTY);
        setRangeError(false);
        setPage(1);
        const next = new URLSearchParams(searchParams);
        next.delete('status');
        setSearchParams(next, { replace: true });
    };
    const [selectedJob, setSelectedJob] = useState<NotificationJob | null>(null);
    const [retryJob, setRetryJob] = useState<NotificationJob | null>(null);
    const patch = (value: Partial<typeof EMPTY>) => setDraft((d) => ({ ...d, ...value }));
    const applyNow = (value: Partial<typeof EMPTY>) => {
        patch(value);
        setApplied((d) => ({ ...d, ...value }));
        setPage(1);
    };
    // 날짜는 순서가 맞을 때만 건다 — 한쪽만 채운 것도 그대로 건다
    const applyRange = (next: typeof EMPTY) => {
        setDraft(next);
        const ordered = isDateRangeOrdered(next.from, next.to);
        setRangeError(!ordered);
        if (ordered) {
            setApplied((d) => ({ ...d, from: next.from, to: next.to }));
            setPage(1);
        }
    };
    const activeCount = [
        applied.status !== ALL,
        applied.notificationType !== ALL,
        applied.eventId,
        applied.from || applied.to,
    ].filter(Boolean).length;

    const query = useAdminNotificationJobs({
        page,
        size: PAGE_SIZE,
        status: orUndefined(applied.status),
        notificationType: orUndefined(applied.notificationType),
        eventId: applied.eventId || undefined,
        from: applied.from ? kstDateStartUtcIso(applied.from) : undefined,
        to: applied.to ? kstNextDateStartUtcIso(applied.to) : undefined,
    });

    return (
        <div className="flex flex-col gap-6">
            {/* 상태·유형·이벤트는 고르는 즉시, 날짜는 두 칸이 맞게 채워지면 바로 걸린다 — 따로 누를 검색 버튼이 없다 */}
            <FilterPanel onReset={resetFilters} activeCount={activeCount}>
                <FilterRow
                    label="상태"
                    value={chipValue(STATUS_OPTIONS, applied.status)}
                    onClear={() => applyNow({ status: ALL })}
                >
                    <FilterChips
                        value={draft.status}
                        onChange={(status) => applyNow({ status })}
                        options={STATUS_OPTIONS}
                        label="작업 상태"
                    />
                </FilterRow>
                <FilterRow
                    label="알림 종류"
                    value={chipValue(TYPE_OPTIONS, applied.notificationType)}
                    onClear={() => applyNow({ notificationType: ALL })}
                >
                    <FilterChips
                        value={draft.notificationType}
                        onChange={(notificationType) => applyNow({ notificationType })}
                        options={TYPE_OPTIONS}
                        label="알림 종류"
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
                    value={rangeValue(applied.from, applied.to)}
                    onClear={() => applyRange({ ...draft, from: '', to: '' })}
                >
                    <DateRangeFilter
                        name="생성일"
                        from={draft.from}
                        to={draft.to}
                        onFromChange={(from) => applyRange({ ...draft, from })}
                        onToChange={(to) => applyRange({ ...draft, to })}
                        error={rangeError ? '시작일이 종료일보다 늦습니다.' : null}
                    />
                </FilterRow>
            </FilterPanel>

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
                        kind="job"
                        targets={(query.data?.items ?? [])
                            .filter((item) => item.retryable)
                            .map((item) => ({
                                id: item.id,
                                label: `${NOTIFICATION_TYPE_LABEL[item.notificationType]} · ${formatKst(item.scheduledAt)} 예정`,
                            }))}
                    />
                }
                emptyText="해당하는 알림 작업이 없습니다."
                errorText="알림 작업 목록을 불러오지 못했습니다."
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
                {(rows) => <NotificationJobTable jobs={rows} onRowClick={setSelectedJob} />}
            </PagedResult>

            <NotificationJobDetailDrawer
                job={selectedJob}
                open={selectedJob !== null}
                onOpenChange={(open) => {
                    if (!open) setSelectedJob(null);
                }}
                action={(job, detailReady) =>
                    job.retryable ? (
                        <Button
                            className="w-full"
                            disabled={!detailReady}
                            onClick={() => setRetryJob(job)}
                        >
                            {detailReady ? '생성 복구 재시도' : '상세를 확인하는 중…'}
                        </Button>
                    ) : null
                }
            />

            <RetryJobDialog
                job={retryJob}
                onOpenChange={(open) => {
                    if (!open) setRetryJob(null);
                }}
            />
        </div>
    );
}
