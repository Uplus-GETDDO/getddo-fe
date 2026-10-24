import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { z } from 'zod';

import { useAdminEntries } from '@entities/entry';
import { AdminEventPicker, AdminEventTitle } from '@entities/event';
import { getErrorMessage } from '@shared/api/errorMessage';
import { ALL, isDateRangeOrdered, orUndefined, PAGE_SIZE } from '@shared/model/filterConstants';
import { badgeVariants } from '@shared/ui/badge';
import { Button } from '@shared/ui/button';
import { DateRangeFilter, TextFilter } from '@shared/ui/filter-fields';
import {
    chipValue,
    FilterChips,
    FilterPanel,
    FilterRow,
    rangeValue,
} from '@shared/ui/filter-panel';
import { PagedResult } from '@shared/ui/paged-result';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@shared/ui/table';
import { cn } from '@shared/utils/cn';
import { formatKstFullDot, kstDateStartUtcIso, kstNextDateStartUtcIso } from '@shared/utils/date';

import { UserCell } from './UserCell';

const STATUS_OPTIONS = [
    { value: ALL, label: '전체' },
    { value: 'ACCEPTED', label: '접수' },
    { value: 'REJECTED', label: '거절' },
];
const STATUS_LABEL = { ACCEPTED: '접수', REJECTED: '거절' } as const;
const STATUS_CHIP = {
    ACCEPTED: 'bg-status-approved text-status-approved-text',
    REJECTED: 'bg-status-rejected text-status-rejected-text',
} as const;

const EMPTY = { userId: '', eventId: '', status: ALL, from: '', to: '' };

const asUuid = (value: string | null) => (value && z.uuid().safeParse(value).success ? value : '');

// AO06 — 응모 이력. userId·eventId는 URL이 진실의 원천이다
export function EntryHistoryPanel() {
    const [searchParams] = useSearchParams();
    const urlUserId = asUuid(searchParams.get('userId'));
    const urlEventId = asUuid(searchParams.get('eventId'));
    const [page, setPage] = useState(1);
    const [draft, setDraft] = useState(() => ({
        ...EMPTY,
        userId: urlUserId,
        eventId: urlEventId,
    }));
    const [applied, setApplied] = useState(draft);
    const [inputError, setInputError] = useState<string | null>(null);

    // 링크 진입·메뉴 이동으로 URL의 userId/eventId가 바뀌면 적용 필터·페이지를 함께 맞춘다
    const urlKey = `${urlUserId}|${urlEventId}`;
    const [prevUrlKey, setPrevUrlKey] = useState(urlKey);
    if (prevUrlKey !== urlKey) {
        const next = { ...EMPTY, userId: urlUserId, eventId: urlEventId };
        setPrevUrlKey(urlKey);
        setDraft(next);
        setApplied(next);
        setInputError(null);
        setPage(1);
    }
    const hasAppliedFilters = JSON.stringify(applied) !== JSON.stringify(EMPTY);
    const resetFilters = () => {
        setDraft(EMPTY);
        setApplied(EMPTY);
        setInputError(null);
        setPage(1);
    };
    const patch = (value: Partial<typeof EMPTY>) => setDraft((d) => ({ ...d, ...value }));

    const query = useAdminEntries({
        page,
        size: PAGE_SIZE,
        userId: applied.userId || undefined,
        eventId: applied.eventId || undefined,
        status: orUndefined(applied.status) as 'ACCEPTED' | 'REJECTED' | undefined,
        from: applied.from ? kstDateStartUtcIso(applied.from) : undefined,
        to: applied.to ? kstNextDateStartUtcIso(applied.to) : undefined,
    });

    // 상태·이벤트는 고르는 즉시 걸고, 글자·날짜만 검색 버튼으로 확정한다
    const applyNow = (value: Partial<typeof EMPTY>) => {
        patch(value);
        setApplied((current) => ({ ...current, ...value }));
        setPage(1);
    };
    const activeCount = (Object.keys(EMPTY) as (keyof typeof EMPTY)[]).filter((key) =>
        key === 'to'
            ? false
            : key === 'from'
              ? applied.from || applied.to
              : applied[key] !== EMPTY[key],
    ).length;
    const RANGE_ERROR = '시작일이 종료일보다 늦습니다.';

    return (
        <div className="flex flex-col gap-6">
            <FilterPanel
                search={
                    <TextFilter
                        value={draft.userId}
                        onChange={(userId) => patch({ userId })}
                        placeholder="사용자 ID로 검색"
                        label="사용자 ID 필터"
                        className="w-full"
                    />
                }
                onSubmit={() => {
                    const userId = draft.userId.trim();
                    const eventId = draft.eventId.trim();
                    if (
                        (userId && !z.uuid().safeParse(userId).success) ||
                        (eventId && !z.uuid().safeParse(eventId).success)
                    ) {
                        setInputError('사용자·이벤트 ID는 올바른 UUID 형식이어야 합니다.');
                        return;
                    }
                    if (!isDateRangeOrdered(draft.from, draft.to)) {
                        setInputError(RANGE_ERROR);
                        return;
                    }
                    setInputError(null);
                    setApplied({ ...draft, userId, eventId });
                    setPage(1);
                }}
                error={inputError && inputError !== RANGE_ERROR ? inputError : null}
                onReset={resetFilters}
                activeCount={activeCount}
            >
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
                    label="상태"
                    value={chipValue(STATUS_OPTIONS, applied.status)}
                    onClear={() => applyNow({ status: ALL })}
                >
                    <FilterChips
                        value={draft.status}
                        onChange={(status) => applyNow({ status })}
                        options={STATUS_OPTIONS}
                        label="응모 상태"
                    />
                </FilterRow>
                <FilterRow
                    label="응모일"
                    apply
                    value={rangeValue(applied.from, applied.to)}
                    onClear={() => applyNow({ from: '', to: '' })}
                >
                    <DateRangeFilter
                        name="응모일"
                        from={draft.from}
                        to={draft.to}
                        onFromChange={(from) => patch({ from })}
                        onToChange={(to) => patch({ to })}
                        error={inputError === RANGE_ERROR ? inputError : null}
                    />
                </FilterRow>
            </FilterPanel>

            <PagedResult
                data={query.data}
                isPending={query.isPending}
                isError={query.isError}
                isFetching={query.isFetching}
                page={page}
                onPageChange={setPage}
                emptyText="해당하는 응모 이력이 없습니다."
                errorText={getErrorMessage(query.error, '응모 이력을 불러오지 못했습니다.')}
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
                    // 좁은 화면에서 표가 넘치면 이 안쪽 가로 스크롤로 접근한다 — 스크롤 영역은
                    // 키보드 진입이 가능해야 하므로 region+tabIndex를 둔다 (GD-316 감사 표와 같은 패턴)
                    <div
                        role="region"
                        aria-label="응모 이력 표 가로 스크롤"
                        tabIndex={0}
                        className="bg-surface-page border-border-default focus-visible:ring-border-focus overflow-x-auto rounded-2xl border focus-visible:ring-2 focus-visible:outline-none [&>[data-slot=table-container]]:overflow-visible"
                    >
                        <Table>
                            <TableHeader>
                                <TableRow className="hover:bg-transparent">
                                    <TableHead className="px-4">상태</TableHead>
                                    <TableHead>이벤트</TableHead>
                                    <TableHead>사용자</TableHead>
                                    <TableHead>응모권</TableHead>
                                    <TableHead>거절 사유</TableHead>
                                    <TableHead>응모일</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {rows.map((row) => (
                                    <TableRow key={row.id}>
                                        {/* 접수·거절이 이 표의 핵심 — 맨 앞 색 칩으로 훑어 내려가며 바로 구분한다 */}
                                        <TableCell className="px-4 py-3">
                                            <span
                                                className={cn(
                                                    badgeVariants({ variant: null }),
                                                    STATUS_CHIP[row.status],
                                                )}
                                            >
                                                {STATUS_LABEL[row.status]}
                                            </span>
                                        </TableCell>
                                        <TableCell className="text-body-sm-bold text-fg-primary max-w-60">
                                            {row.eventTitle}
                                        </TableCell>
                                        <TableCell>
                                            {/* 이름은 표시용 부가 정보 — 동일인 식별·링크는 userId를 쓴다 (ADR-028) */}
                                            <UserCell userId={row.userId} userName={row.userName} />
                                        </TableCell>
                                        {/* 실제로 빠진 장수를 크게, 요청 장수는 아래 작은 글로 — 차감이 없으면 흐리게 */}
                                        <TableCell className="tabular-nums">
                                            <span
                                                className={
                                                    row.deductedTicketCount > 0
                                                        ? 'text-body-sm-bold text-fg-primary block'
                                                        : 'text-body-sm text-fg-tertiary block'
                                                }
                                            >
                                                {row.deductedTicketCount > 0
                                                    ? `${row.deductedTicketCount}장 차감`
                                                    : '차감 없음'}
                                            </span>
                                            <span className="text-caption text-fg-tertiary block">
                                                {row.requestedTicketCount}장 요청
                                            </span>
                                        </TableCell>
                                        <TableCell
                                            className={
                                                row.rejectionReason
                                                    ? 'text-body-sm text-status-rejected-text max-w-60'
                                                    : 'text-body-sm text-fg-tertiary'
                                            }
                                        >
                                            {row.rejectionReason ?? '—'}
                                        </TableCell>
                                        <TableCell className="text-fg-secondary text-body-sm whitespace-nowrap tabular-nums">
                                            {formatKstFullDot(row.requestedAt, true)}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                )}
            </PagedResult>
        </div>
    );
}
