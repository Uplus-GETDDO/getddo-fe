import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { z } from 'zod';

import { useAdminParticipants } from '@entities/entry';
import { AdminEventPicker, AdminEventTitle } from '@entities/event';
import { getErrorMessage } from '@shared/api/errorMessage';
import { PAGE_SIZE } from '@shared/model/filterConstants';
import { Button } from '@shared/ui/button';
import { PagedResult } from '@shared/ui/paged-result';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@shared/ui/table';
import { formatKstFullDot } from '@shared/utils/date';

import { UserCell } from './UserCell';

const asUuid = (value: string | null) => (value && z.uuid().safeParse(value).success ? value : '');

// AO07 — 이벤트 참여자. 이벤트를 고르기 전(또는 URL의 eventId가 UUID가 아니면)에는 안내만 하고 요청하지 않는다.
// 삭제된 이벤트도 계약대로 직접 조회할 수 있게 이벤트 상세 조회 성공에 의존하지 않는다.
export function ParticipantsPanel() {
    const [searchParams] = useSearchParams();
    const urlEventId = asUuid(searchParams.get('eventId'));
    const [eventId, setEventId] = useState(urlEventId);
    const [page, setPage] = useState(1);

    // URL의 eventId가 바뀌면 입력·조회 상태를 함께 맞춘다
    const [prevUrlEventId, setPrevUrlEventId] = useState(urlEventId);
    if (prevUrlEventId !== urlEventId) {
        setPrevUrlEventId(urlEventId);
        setEventId(urlEventId);
        setPage(1);
    }

    const query = useAdminParticipants(eventId || null, { page, size: PAGE_SIZE });
    const select = (next: string) => {
        setEventId(next);
        setPage(1);
    };

    return (
        <div className="flex flex-col gap-6">
            {/* 탭 없이 링크로만 들어오는 보기라, 어디서 왔는지와 무엇의 참여자인지를 맨 위에 둔다 */}
            <div className="flex flex-col gap-2">
                <Button variant="link" size="text" className="w-fit" asChild>
                    <Link to={eventId ? `/admin/events/${eventId}` : '/admin/entries'}>
                        {eventId ? '이벤트 상세로' : '응모 이력으로'}
                    </Link>
                </Button>
                <h2 className="text-title-2 text-fg-primary">
                    {eventId ? <AdminEventTitle eventId={eventId} /> : '이벤트'} 참여자
                </h2>
            </div>
            <AdminEventPicker eventId={eventId} onChange={select} label="참여자를 볼 이벤트" />

            {!eventId && (
                <p className="text-body-sm text-fg-secondary py-6">
                    이벤트를 고르면 참여자를 볼 수 있어요.
                </p>
            )}

            {eventId && (
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
                            className="bg-surface-page border-border-default focus-visible:ring-border-focus overflow-x-auto rounded-2xl border focus-visible:ring-2 focus-visible:outline-none [&>[data-slot=table-container]]:overflow-visible"
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
                                        <TableRow key={row.id}>
                                            <TableCell className="px-4 py-3">
                                                <UserCell
                                                    userId={row.userId}
                                                    userName={row.userName}
                                                />
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
            )}
        </div>
    );
}
