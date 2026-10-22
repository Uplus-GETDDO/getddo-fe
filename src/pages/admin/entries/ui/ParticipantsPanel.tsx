import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { z } from 'zod';

import { useAdminParticipants } from '@entities/entry';
import { getErrorMessage } from '@shared/api/errorMessage';
import { PAGE_SIZE } from '@shared/model/filterConstants';
import { Button } from '@shared/ui/button';
import { TextFilter } from '@shared/ui/filter-fields';
import { PagedResult } from '@shared/ui/paged-result';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@shared/ui/table';
import { formatKstDot } from '@shared/utils/date';

const asUuid = (value: string | null) => (value && z.uuid().safeParse(value).success ? value : '');

// AO07 — 이벤트 참여자. eventId가 없거나 UUID가 아니면 안내만 하고 요청하지 않는다.
// 삭제된 이벤트도 계약대로 직접 조회할 수 있게 이벤트 상세 조회 성공에 의존하지 않는다.
export function ParticipantsPanel() {
    const [searchParams] = useSearchParams();
    const urlEventId = asUuid(searchParams.get('eventId'));
    const [eventIdDraft, setEventIdDraft] = useState(urlEventId);
    const [eventId, setEventId] = useState(urlEventId);
    const [inputError, setInputError] = useState(false);
    const [page, setPage] = useState(1);

    // URL의 eventId가 바뀌면 입력·조회 상태를 함께 맞춘다
    const [prevUrlEventId, setPrevUrlEventId] = useState(urlEventId);
    if (prevUrlEventId !== urlEventId) {
        setPrevUrlEventId(urlEventId);
        setEventIdDraft(urlEventId);
        setEventId(urlEventId);
        setInputError(false);
        setPage(1);
    }

    const query = useAdminParticipants(eventId || null, { page, size: PAGE_SIZE });

    return (
        <div className="flex flex-col gap-6">
            <form
                className="flex flex-wrap items-center gap-2"
                onSubmit={(e) => {
                    e.preventDefault();
                    const next = eventIdDraft.trim();
                    if (next && !z.uuid().safeParse(next).success) {
                        setInputError(true);
                        return;
                    }
                    setInputError(false);
                    setEventId(next);
                    setPage(1);
                }}
            >
                <TextFilter
                    value={eventIdDraft}
                    onChange={setEventIdDraft}
                    placeholder="이벤트 ID"
                    label="이벤트 ID 입력"
                    className="w-80"
                />
                <Button type="submit" variant="secondary">
                    참여자 조회
                </Button>
                {inputError && (
                    <p role="alert" className="text-semantic-error-strong text-caption basis-full">
                        올바른 UUID 형식이 아닙니다.
                    </p>
                )}
            </form>

            {!eventId && !inputError && (
                <p className="text-body-sm text-fg-secondary py-6">
                    이벤트 ID를 입력하면 참여자를 조회합니다.
                </p>
            )}

            {eventId && (
                <PagedResult
                    data={query.data}
                    isPending={query.isPending}
                    isError={query.isError}
                    isFetching={query.isFetching}
                    page={page}
                    onPageChange={setPage}
                    countUnit="명"
                    emptyText="접수된 참여자가 없습니다."
                    errorText={getErrorMessage(query.error, '참여자를 불러오지 못했습니다.')}
                    onRetry={() => void query.refetch()}
                >
                    {(rows) => (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>사용자</TableHead>
                                    <TableHead>참여자 ID</TableHead>
                                    <TableHead>사용 응모권</TableHead>
                                    <TableHead>최초 응모</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {rows.map((row) => (
                                    <TableRow key={row.id}>
                                        <TableCell>
                                            <Link
                                                className="text-fg-brand text-body-sm hover:underline"
                                                to={`/admin/users?detail=${row.userId}`}
                                            >
                                                {row.userName ?? row.userId}
                                            </Link>
                                            {row.userName && (
                                                <span className="text-caption text-fg-secondary block">
                                                    {row.userId}
                                                </span>
                                            )}
                                        </TableCell>
                                        <TableCell className="text-fg-secondary text-caption">
                                            {row.id}
                                        </TableCell>
                                        <TableCell>{row.usedTicketCount}장</TableCell>
                                        <TableCell className="text-fg-secondary text-body-sm">
                                            {formatKstDot(row.createdAt, true)}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </PagedResult>
            )}
        </div>
    );
}
