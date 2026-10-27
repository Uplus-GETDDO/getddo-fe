import { useState } from 'react';

import { useAdminParticipants } from '@entities/entry';
import { getErrorMessage } from '@shared/api/errorMessage';
import { PAGE_SIZE } from '@shared/model/filterConstants';
import { PagedResult } from '@shared/ui/paged-result';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@shared/ui/table';
import { cn } from '@shared/utils/cn';
import { formatKstFullDot } from '@shared/utils/date';

/**
 * AO07 이벤트 참여자 표 — 줄을 누르면 그 사용자를 고른다(상세는 부르는 쪽이 연다).
 * 응모 조회의 참여자 보기와 이벤트 상세의 참여자 모달이 같이 쓴다. 페이지는 이 표가 들고 있다
 */
export function EventParticipantsTable({
    eventId,
    selectedUserId,
    onSelectUser,
}: {
    eventId: string;
    selectedUserId?: string | null;
    onSelectUser: (userId: string) => void;
}) {
    const [page, setPage] = useState(1);
    // 다른 이벤트로 바뀌면 첫 페이지부터 본다
    const [prevEventId, setPrevEventId] = useState(eventId);
    if (prevEventId !== eventId) {
        setPrevEventId(eventId);
        setPage(1);
    }
    const query = useAdminParticipants(eventId, { page, size: PAGE_SIZE });

    return (
        <PagedResult
            data={query.data}
            isPending={query.isPending}
            isError={query.isError}
            isFetching={query.isFetching}
            updatedAt={query.dataUpdatedAt}
            page={page}
            onPageChange={setPage}
            countUnit="명"
            emptyText="접수된 참여자가 없습니다."
            errorText={getErrorMessage(query.error, '참여자를 불러오지 못했습니다.')}
            onRetry={() => void query.refetch()}
        >
            {(rows) => (
                // 좁은 화면에서 표가 넘치면 이 안쪽 가로 스크롤로 접근한다 — 스크롤 영역은
                // 키보드 진입이 가능해야 하므로 region+tabIndex를 둔다 (GD-316 감사 표와 같은 패턴)
                <div
                    role="region"
                    aria-label="참여자 표 가로 스크롤"
                    tabIndex={0}
                    className="bg-surface-page border-border-default focus-visible:ring-border-focus overflow-x-auto border-y focus-visible:ring-2 focus-visible:outline-none [&>[data-slot=table-container]]:overflow-visible"
                >
                    <Table>
                        <TableHeader>
                            <TableRow className="hover:bg-transparent">
                                <TableHead className="px-4">사용자</TableHead>
                                <TableHead>사용 응모권</TableHead>
                                <TableHead>최초 응모</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {rows.map((row) => (
                                <TableRow
                                    key={row.id}
                                    role="button"
                                    tabIndex={0}
                                    aria-label={`${row.userName ?? row.userId} 상세 보기`}
                                    aria-current={row.userId === selectedUserId || undefined}
                                    className={cn(
                                        'cursor-pointer',
                                        row.userId === selectedUserId && 'bg-surface-sunken',
                                    )}
                                    onClick={() => onSelectUser(row.userId)}
                                    onKeyDown={(event) => {
                                        if (event.key === 'Enter' || event.key === ' ') {
                                            event.preventDefault();
                                            onSelectUser(row.userId);
                                        }
                                    }}
                                >
                                    {/* 이름이 없으면 ID를 보인다 (ADR-028) */}
                                    <TableCell className="px-4 py-3">
                                        <span className="text-body-sm-bold text-fg-primary block">
                                            {row.userName ?? row.userId}
                                        </span>
                                        {row.userName && (
                                            <span className="text-caption text-fg-tertiary block">
                                                {row.userId}
                                            </span>
                                        )}
                                    </TableCell>
                                    <TableCell className="text-body-sm-bold text-fg-primary tabular-nums">
                                        {row.usedTicketCount}장
                                    </TableCell>
                                    <TableCell className="text-fg-secondary text-body-sm tabular-nums">
                                        {formatKstFullDot(row.createdAt, true)}
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            )}
        </PagedResult>
    );
}
