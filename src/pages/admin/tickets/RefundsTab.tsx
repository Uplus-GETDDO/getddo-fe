import { useState } from 'react';

import { TicketRefundTable, useAdminTicketRefunds } from '@entities/ticket';
import { kstDateStartUtcIso, kstNextDateStartUtcIso } from '@shared/lib/date';
import { isDateRangeOrdered, PAGE_SIZE } from '@shared/lib/filterConstants';
import { Button } from '@shared/ui/button';
import { DateRangeFilter, TextFilter } from '@shared/ui/filter-fields';
import { PagedResult } from '@shared/ui/paged-result';

const EMPTY = { eventId: '', userId: '', from: '', to: '' };

// AO08 — 이벤트 취소로 반환된 응모권. 반환은 즉시 끝나므로 처리 상태 필터가 없다.
// 실서버는 이벤트 취소→반환 연결 전까지 빈 목록이라 빈 상태를 정상 안내로 보여준다
export function RefundsTab() {
    const [page, setPage] = useState(1);
    const [draft, setDraft] = useState(EMPTY);
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
    const patch = (value: Partial<typeof EMPTY>) => setDraft((d) => ({ ...d, ...value }));

    const query = useAdminTicketRefunds({
        page,
        size: PAGE_SIZE,
        eventId: applied.eventId || undefined,
        userId: applied.userId || undefined,
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
                        eventId: draft.eventId.trim(),
                        userId: draft.userId.trim(),
                    });
                    setPage(1);
                }}
            >
                <TextFilter
                    value={draft.eventId}
                    onChange={(eventId) => patch({ eventId })}
                    placeholder="이벤트 ID"
                    label="이벤트 ID 필터"
                />
                <TextFilter
                    value={draft.userId}
                    onChange={(userId) => patch({ userId })}
                    placeholder="사용자 ID"
                    label="사용자 ID 필터"
                />
                <DateRangeFilter
                    from={draft.from}
                    to={draft.to}
                    onFromChange={(from) => patch({ from })}
                    onToChange={(to) => patch({ to })}
                    basis="반환일"
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
                emptyText="이벤트 취소로 반환된 응모권이 없습니다."
                errorText="반환 이력을 불러오지 못했습니다."
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
                {(rows) => <TicketRefundTable rows={rows} />}
            </PagedResult>
        </div>
    );
}
