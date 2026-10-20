import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { z } from 'zod';

import { useAdminEntries } from '@entities/entry';
import { getErrorMessage } from '@shared/api/errorMessage';
import { ALL, isDateRangeOrdered, orUndefined, PAGE_SIZE } from '@shared/model/filterConstants';
import { Button } from '@shared/ui/button';
import { DateRangeFilter, OptionFilter, TextFilter } from '@shared/ui/filter-fields';
import { PagedResult } from '@shared/ui/paged-result';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@shared/ui/table';
import { formatKstDot } from '@shared/utils/date';
import { kstDateStartUtcIso, kstNextDateStartUtcIso } from '@shared/utils/date';

const STATUS_OPTIONS = [
    { value: ALL, label: '전체 상태' },
    { value: 'ACCEPTED', label: '접수' },
    { value: 'REJECTED', label: '거절' },
];
const STATUS_LABEL = { ACCEPTED: '접수', REJECTED: '거절' } as const;

const EMPTY = { userId: '', eventId: '', status: ALL, from: '', to: '' };

const asUuid = (value: string | null) => (value && z.uuid().safeParse(value).success ? value : '');

// AO06 — 응모 이력. userId·eventId 링크 진입은 URL 초기값으로 읽는다
export function EntryHistoryPanel() {
    const [searchParams] = useSearchParams();
    const [initial] = useState(() => ({
        ...EMPTY,
        userId: asUuid(searchParams.get('userId')),
        eventId: asUuid(searchParams.get('eventId')),
    }));
    const [page, setPage] = useState(1);
    const [draft, setDraft] = useState(initial);
    const [applied, setApplied] = useState(initial);
    const [inputError, setInputError] = useState<string | null>(null);
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

    return (
        <div className="flex flex-col gap-6">
            <form
                className="flex flex-wrap items-center gap-2"
                onSubmit={(e) => {
                    e.preventDefault();
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
                        setInputError('시작일이 종료일보다 늦습니다.');
                        return;
                    }
                    setInputError(null);
                    setApplied({ ...draft, userId, eventId });
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
                <OptionFilter
                    value={draft.status}
                    onChange={(status) => patch({ status })}
                    options={STATUS_OPTIONS}
                    label="응모 상태 필터"
                />
                <DateRangeFilter
                    from={draft.from}
                    to={draft.to}
                    onFromChange={(from) => patch({ from })}
                    onToChange={(to) => patch({ to })}
                    basis="응모일"
                    error={inputError === '시작일이 종료일보다 늦습니다.' ? inputError : null}
                />
                <Button type="submit" variant="secondary">
                    검색
                </Button>
                <Button type="button" variant="ghost" onClick={resetFilters}>
                    초기화
                </Button>
                {inputError && inputError !== '시작일이 종료일보다 늦습니다.' && (
                    <p role="alert" className="text-semantic-error-strong text-caption basis-full">
                        {inputError}
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
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>응모일</TableHead>
                                <TableHead>이벤트</TableHead>
                                <TableHead>사용자 ID</TableHead>
                                <TableHead>상태</TableHead>
                                <TableHead>요청</TableHead>
                                <TableHead>차감</TableHead>
                                <TableHead>거절 사유</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {rows.map((row) => (
                                <TableRow key={row.id}>
                                    <TableCell className="text-fg-secondary text-body-sm">
                                        {formatKstDot(row.requestedAt, true)}
                                    </TableCell>
                                    <TableCell>{row.eventTitle}</TableCell>
                                    <TableCell>
                                        <Link
                                            className="text-fg-brand text-caption hover:underline"
                                            to={`/admin/users?detail=${row.userId}`}
                                        >
                                            {row.userId}
                                        </Link>
                                    </TableCell>
                                    <TableCell>{STATUS_LABEL[row.status]}</TableCell>
                                    <TableCell>{row.requestedTicketCount}장</TableCell>
                                    <TableCell>{row.deductedTicketCount}장</TableCell>
                                    <TableCell className="text-fg-secondary text-body-sm">
                                        {row.rejectionReason ?? '—'}
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                )}
            </PagedResult>
        </div>
    );
}
