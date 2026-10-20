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
import { RetryJobDialog } from '@features/retryAdminNotification';
import { kstDateStartUtcIso, kstNextDateStartUtcIso } from '@shared/lib/date';
import { ALL, isDateRangeOrdered, orUndefined, PAGE_SIZE } from '@shared/lib/filterConstants';
import { Button } from '@shared/ui/button';
import { DateRangeFilter, OptionFilter, TextFilter } from '@shared/ui/filter-fields';
import { PagedResult } from '@shared/ui/paged-result';

const STATUS_OPTIONS = [
    { value: ALL, label: '작업 상태' },
    ...Object.entries(NOTIFICATION_JOB_STATUS_LABEL).map(([value, label]) => ({ value, label })),
];

const TYPE_OPTIONS = [
    { value: ALL, label: '알림 유형' },
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
    const hasPendingDraft = JSON.stringify(draft) !== JSON.stringify(applied);
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
            <form
                className="flex flex-wrap items-center gap-2"
                onSubmit={(e) => {
                    e.preventDefault();
                    if (!isDateRangeOrdered(draft.from, draft.to)) {
                        setRangeError(true);
                        return;
                    }
                    setRangeError(false);
                    setApplied({ ...draft, eventId: draft.eventId.trim() });
                    setPage(1);
                }}
            >
                <OptionFilter
                    value={draft.status}
                    onChange={(status) => patch({ status })}
                    options={STATUS_OPTIONS}
                    label="상태 필터"
                />
                <OptionFilter
                    value={draft.notificationType}
                    onChange={(notificationType) => patch({ notificationType })}
                    options={TYPE_OPTIONS}
                    label="유형 필터"
                    className="w-40"
                />
                <TextFilter
                    value={draft.eventId}
                    onChange={(eventId) => patch({ eventId })}
                    placeholder="이벤트 ID"
                    label="이벤트 ID 필터"
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
                action={(job, detailReady) => (
                    <div className="mt-2 flex flex-col gap-1">
                        <Button
                            variant="secondary"
                            disabled={!job.retryable || !detailReady}
                            aria-describedby={
                                job.retryable && detailReady
                                    ? undefined
                                    : 'job-retry-disabled-reason'
                            }
                            onClick={() => setRetryJob(job)}
                        >
                            생성 복구 재시도
                        </Button>
                        {(!job.retryable || !detailReady) && (
                            <p
                                id="job-retry-disabled-reason"
                                className="text-fg-tertiary text-caption"
                            >
                                {!detailReady
                                    ? '작업 상세를 불러오지 못해 복구를 진행할 수 없습니다.'
                                    : job.generationStoppedBy
                                      ? `생성이 중지된 작업입니다 (${job.generationStoppedBy}).`
                                      : '복구할 수 없는 상태입니다.'}
                            </p>
                        )}
                    </div>
                )}
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
