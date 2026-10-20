import { useCallback, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import {
    AdminTicketHistoryTable,
    TICKET_OPERATION_LABEL,
    useAdminTicketHistories,
} from '@entities/ticket';
import { ALL, isDateRangeOrdered, orUndefined, PAGE_SIZE } from '@shared/model/filterConstants';
import { Button } from '@shared/ui/button';
import { DateRangeFilter, OptionFilter, TextFilter } from '@shared/ui/filter-fields';
import { PagedResult } from '@shared/ui/paged-result';
import { kstDateStartUtcIso, kstNextDateStartUtcIso, parseYmd } from '@shared/utils/date';

import { useLinkedUserId } from './hooks/useLinkedUserId';

const OPERATION_OPTIONS = [
    { value: ALL, label: '전체 처리' },
    ...Object.entries(TICKET_OPERATION_LABEL).map(([value, label]) => ({ value, label })),
];

const EMPTY = { userId: '', eventId: '', missionId: '', operationType: ALL, from: '', to: '' };

// AO05 — 전체 이력
export function HistoriesTab() {
    // 대시보드 숫자 카드에서 들어오면(?date=YYYY-MM-DD&operationType=USE) 그 조건이 걸린 채 연다
    const [searchParams] = useSearchParams();
    const linkedDate = parseYmd(searchParams.get('date'));
    const linkedOperation = searchParams.get('operationType');
    const linkedUserId = searchParams.get('userId');
    const initial = {
        ...EMPTY,
        ...(linkedUserId && { userId: linkedUserId }),
        ...(linkedDate && { from: linkedDate, to: linkedDate }),
        ...(linkedOperation &&
            OPERATION_OPTIONS.some((option) => option.value === linkedOperation) && {
                operationType: linkedOperation,
            }),
    };
    const [page, setPage] = useState(1);
    const [draft, setDraft] = useState(initial);
    const [applied, setApplied] = useState(initial);
    const [rangeError, setRangeError] = useState(false);
    // 같은 화면에서 ?date= · ?operationType= 이 바뀌면 이전 링크의 조건이 남지 않게 URL 기준으로 덮는다
    const linkedKey = `${linkedDate ?? ''}|${linkedOperation ?? ''}`;
    const [prevLinkedKey, setPrevLinkedKey] = useState(linkedKey);
    if (prevLinkedKey !== linkedKey) {
        setPrevLinkedKey(linkedKey);
        const validOperation =
            linkedOperation && OPERATION_OPTIONS.some((option) => option.value === linkedOperation)
                ? linkedOperation
                : ALL;
        const patchLinked = (d: typeof EMPTY) => ({
            ...d,
            from: linkedDate ?? '',
            to: linkedDate ?? '',
            operationType: validOperation,
        });
        setDraft(patchLinked);
        setApplied(patchLinked);
        setRangeError(false);
        setPage(1);
    }
    const hasPendingDraft = JSON.stringify(draft) !== JSON.stringify(applied);
    const hasAppliedFilters = JSON.stringify(applied) !== JSON.stringify(EMPTY);
    const resetFilters = () => {
        setDraft(EMPTY);
        setApplied(EMPTY);
        setRangeError(false);
        setPage(1);
    };
    const patch = (value: Partial<typeof EMPTY>) => setDraft((d) => ({ ...d, ...value }));
    useLinkedUserId(
        useCallback((userId) => {
            setDraft((d) => ({ ...d, userId: userId ?? '' }));
            setApplied((d) => ({ ...d, userId: userId ?? '' }));
            setPage(1);
        }, []),
    );

    const query = useAdminTicketHistories({
        page,
        size: PAGE_SIZE,
        userId: applied.userId || undefined,
        eventId: applied.eventId || undefined,
        missionId: applied.missionId || undefined,
        operationType: orUndefined(applied.operationType),
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
                        missionId: draft.missionId.trim(),
                    });
                    setPage(1);
                }}
            >
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
                    value={draft.missionId}
                    onChange={(missionId) => patch({ missionId })}
                    placeholder="미션 ID"
                    label="미션 ID 필터"
                />
                <OptionFilter
                    value={draft.operationType}
                    onChange={(operationType) => patch({ operationType })}
                    options={OPERATION_OPTIONS}
                    label="처리 유형 필터"
                />
                <DateRangeFilter
                    from={draft.from}
                    to={draft.to}
                    onFromChange={(from) => patch({ from })}
                    onToChange={(to) => patch({ to })}
                    basis="처리일"
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
                page={page}
                onPageChange={setPage}
                emptyText="해당하는 이력이 없습니다."
                errorText="이력을 불러오지 못했습니다."
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
                {(rows) => <AdminTicketHistoryTable rows={rows} />}
            </PagedResult>
        </div>
    );
}
