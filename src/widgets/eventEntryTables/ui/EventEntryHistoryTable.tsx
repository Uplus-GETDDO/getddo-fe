import { useState } from 'react';

import { useAdminEntries } from '@entities/entry';
import { getErrorMessage } from '@shared/api/errorMessage';
import { ALL, orUndefined, PAGE_SIZE } from '@shared/model/filterConstants';
import { badgeVariants } from '@shared/ui/badge';
import { FilterChips } from '@shared/ui/filter-panel';
import { PagedResult } from '@shared/ui/paged-result';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@shared/ui/table';
import { cn } from '@shared/utils/cn';
import { formatKstFullDot } from '@shared/utils/date';

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

/**
 * AO06 한 이벤트의 응모 이력 — 접수·거절만 칩으로 거른다. 이벤트가 정해져 있어 이벤트 칸은 두지 않는다.
 * 사용자·기간까지 거르는 전체 검색은 응모 조회 화면이 맡는다
 */
export function EventEntryHistoryTable({ eventId }: { eventId: string }) {
    const [page, setPage] = useState(1);
    const [status, setStatus] = useState(ALL);
    const query = useAdminEntries({
        page,
        size: PAGE_SIZE,
        eventId,
        status: orUndefined(status) as 'ACCEPTED' | 'REJECTED' | undefined,
    });

    return (
        <div className="flex flex-col gap-4">
            <FilterChips
                value={status}
                onChange={(next) => {
                    setStatus(next);
                    setPage(1);
                }}
                options={STATUS_OPTIONS}
                label="응모 상태"
            />
            <PagedResult
                data={query.data}
                isPending={query.isPending}
                isError={query.isError}
                isFetching={query.isFetching}
                updatedAt={query.dataUpdatedAt}
                page={page}
                onPageChange={setPage}
                emptyText="해당하는 응모 이력이 없습니다."
                errorText={getErrorMessage(query.error, '응모 이력을 불러오지 못했습니다.')}
                onRetry={() => void query.refetch()}
            >
                {(rows) => (
                    <div
                        role="region"
                        aria-label="응모 이력 표 가로 스크롤"
                        tabIndex={0}
                        className="bg-surface-page border-border-default focus-visible:ring-border-focus overflow-x-auto border-y focus-visible:ring-2 focus-visible:outline-none [&>[data-slot=table-container]]:overflow-visible"
                    >
                        <Table>
                            <TableHeader>
                                <TableRow className="hover:bg-transparent">
                                    <TableHead className="px-4">상태</TableHead>
                                    <TableHead>사용자</TableHead>
                                    <TableHead>응모권</TableHead>
                                    <TableHead>거절 사유</TableHead>
                                    <TableHead>응모일</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {rows.map((row) => (
                                    <TableRow key={row.id}>
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
                                        {/* 이름은 표시용 부가 정보 — 동일인 식별은 userId로 한다 (ADR-028) */}
                                        <TableCell>
                                            <span className="text-body-sm-bold text-fg-primary block">
                                                {row.userName ?? row.userId}
                                            </span>
                                            {row.userName && (
                                                <span className="text-caption text-fg-tertiary block">
                                                    {row.userId}
                                                </span>
                                            )}
                                        </TableCell>
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
