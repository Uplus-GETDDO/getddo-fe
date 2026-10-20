import { useCallback, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import { TICKET_GRADE_LABEL, TicketGrantTable, useAdminTicketGrants } from '@entities/ticket';
import { ALL, isDateRangeOrdered, orUndefined, PAGE_SIZE } from '@shared/model/filterConstants';
import { Button } from '@shared/ui/button';
import { DateRangeFilter, OptionFilter, TextFilter } from '@shared/ui/filter-fields';
import { PagedResult } from '@shared/ui/paged-result';
import { kstDateStartUtcIso, kstNextDateStartUtcIso, parseYmd } from '@shared/utils/date';

import { useLinkedUserId } from './hooks/useLinkedUserId';

const SOURCE_OPTIONS = [
    { value: ALL, label: '전체 구분' },
    { value: 'ATTENDANCE', label: '출석' },
    { value: 'MISSION', label: '미션' },
    { value: 'GAME', label: '게임' },
];

const GRADE_OPTIONS = [
    { value: ALL, label: '전체 등급' },
    ...Object.entries(TICKET_GRADE_LABEL).map(([value, label]) => ({ value, label })),
];

const EMPTY = {
    keyword: '',
    userId: '',
    missionId: '',
    sourceType: ALL,
    grade: ALL,
    from: '',
    to: '',
};

// AO03 — 지급 응모권 수는 totalElements다. 등급별 수는 등급 필터를 바꿔 조회한다
export function GrantsTab() {
    // 대시보드 그래프에서 날짜를 눌러 들어오면(?date=YYYY-MM-DD) 그날로 걸러진 채 연다
    const [searchParams] = useSearchParams();
    const linkedDate = parseYmd(searchParams.get('date'));
    const linkedUserId = searchParams.get('userId');
    const initial = {
        ...EMPTY,
        ...(linkedDate && { from: linkedDate, to: linkedDate }),
        ...(linkedUserId && { userId: linkedUserId }),
    };
    const [page, setPage] = useState(1);
    const [draft, setDraft] = useState(initial);
    // 검색 버튼으로 확정한 값만 쿼리에 넘긴다 — 입력마다 요청하지 않는다
    const [applied, setApplied] = useState(initial);
    const [rangeError, setRangeError] = useState(false);
    // 같은 화면에서 ?date= 가 바뀌면 이전 링크의 날짜가 남지 않게 URL 기준으로 덮는다
    const [prevLinkedDate, setPrevLinkedDate] = useState(linkedDate);
    if (prevLinkedDate !== linkedDate) {
        setPrevLinkedDate(linkedDate);
        const patchLinked = (d: typeof EMPTY) => ({
            ...d,
            from: linkedDate ?? '',
            to: linkedDate ?? '',
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

    const query = useAdminTicketGrants({
        page,
        size: PAGE_SIZE,
        keyword: applied.keyword || undefined,
        userId: applied.userId || undefined,
        missionId: applied.missionId || undefined,
        sourceType: orUndefined(applied.sourceType),
        grade: orUndefined(applied.grade),
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
                        keyword: draft.keyword.trim(),
                        userId: draft.userId.trim(),
                        missionId: draft.missionId.trim(),
                    });
                    setPage(1);
                }}
            >
                <TextFilter
                    value={draft.keyword}
                    onChange={(keyword) => patch({ keyword })}
                    placeholder="사용자 이름 검색"
                    label="사용자 이름 검색"
                />
                <TextFilter
                    value={draft.userId}
                    onChange={(userId) => patch({ userId })}
                    placeholder="사용자 ID"
                    label="사용자 ID 필터"
                />
                <TextFilter
                    value={draft.missionId}
                    onChange={(missionId) => patch({ missionId })}
                    placeholder="미션 ID"
                    label="미션 ID 필터"
                />
                <OptionFilter
                    value={draft.sourceType}
                    onChange={(sourceType) => patch({ sourceType })}
                    options={SOURCE_OPTIONS}
                    label="구분 필터"
                />
                <OptionFilter
                    value={draft.grade}
                    onChange={(grade) => patch({ grade })}
                    options={GRADE_OPTIONS}
                    label="등급 필터"
                />
                <DateRangeFilter
                    from={draft.from}
                    to={draft.to}
                    onFromChange={(from) => patch({ from })}
                    onToChange={(to) => patch({ to })}
                    basis="지급일"
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
                emptyText="해당하는 지급 이력이 없습니다."
                errorText="지급 이력을 불러오지 못했습니다."
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
                {(rows) => <TicketGrantTable rows={rows} />}
            </PagedResult>
        </div>
    );
}
