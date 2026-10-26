import { useState } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import { z } from 'zod';

import { useAdminParticipants } from '@entities/entry';
import { AdminEventPicker, AdminEventTitle } from '@entities/event';
import { useAdminUser } from '@entities/user';
import { getErrorMessage } from '@shared/api/errorMessage';
import { PAGE_SIZE } from '@shared/model/filterConstants';
import { readReturnTo } from '@shared/model/returnTo';
import { Button } from '@shared/ui/button';
import { ListDetailLayout } from '@shared/ui/inspector';
import { PagedResult } from '@shared/ui/paged-result';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@shared/ui/table';
import { cn } from '@shared/utils/cn';
import { formatKstFullDot } from '@shared/utils/date';
import { AdminUserDetailSheet } from '@widgets/adminUserDetail';

const asUuid = (value: string | null) => (value && z.uuid().safeParse(value).success ? value : '');

// AO07 — 이벤트 참여자. 이벤트를 고르기 전(또는 URL의 eventId가 UUID가 아니면)에는 안내만 하고 요청하지 않는다.
// 삭제된 이벤트도 계약대로 직접 조회할 수 있게 이벤트 상세 조회 성공에 의존하지 않는다.
export function ParticipantsPanel() {
    const [searchParams, setSearchParams] = useSearchParams();
    // 고른 참여자 — 사용자 조회와 같은 ?detail= 로 둬 새로고침·뒤로가기에도 같은 사람이 열려 있다
    const detailId = asUuid(searchParams.get('detail')) || null;
    const detailQuery = useAdminUser(detailId);
    // 상세를 열고 닫는 것은 같은 화면 안의 일이라 보던 이벤트·보기 조건은 두고 스크롤도 올리지 않는다
    const setDetail = (id: string | null) => {
        const next = new URLSearchParams(searchParams);
        if (id) next.set('detail', id);
        else next.delete('detail');
        // 이벤트 관리에서 실려 온 돌아갈 곳(state)도 그대로 넘긴다 — 안 그러면 줄을 누르는 순간 머리의 '← 돌아가기'가 사라졌다
        setSearchParams(next, { preventScrollReset: true, state: location.state as unknown });
    };
    // 다른 화면에서 건너왔으면 머리의 '← 돌아가기'가 길을 맡는다 — 여기 링크까지 두면 두 개가 겹친다
    const location = useLocation();
    const cameWithReturn = readReturnTo(location.state as unknown) !== null;
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
                {!cameWithReturn && (
                    <Button variant="link" size="text" className="w-fit" asChild>
                        <Link to={eventId ? `/admin/events/${eventId}` : '/admin/entries'}>
                            {eventId ? '이벤트 상세로' : '응모 이력으로'}
                        </Link>
                    </Button>
                )}
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

            {/*
             * 줄을 누르면 사용자 조회와 같은 상세가 옆 칸에 열린다 — 이름·ID를 복사해 사용자 조회에서
             * 다시 검색하지 않아도 된다. 상세의 '응모·응모권 이력 조회'로 이어서 갈 수 있다
             */}
            {eventId && (
                <ListDetailLayout
                    open={detailId !== null}
                    detailKey={detailId}
                    label="참여자 상세"
                    detail={
                        <AdminUserDetailSheet
                            userId={detailId}
                            user={detailQuery.data}
                            isPending={detailQuery.isPending}
                            error={detailQuery.error}
                            onClose={() => setDetail(null)}
                            returnLabel="응모 조회 · 참여자"
                        />
                    }
                    list={
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
                            errorText={getErrorMessage(
                                query.error,
                                '참여자를 불러오지 못했습니다.',
                            )}
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
                                                    aria-current={
                                                        row.userId === detailId || undefined
                                                    }
                                                    className={cn(
                                                        'cursor-pointer',
                                                        row.userId === detailId &&
                                                            'bg-surface-sunken',
                                                    )}
                                                    onClick={() => setDetail(row.userId)}
                                                    onKeyDown={(event) => {
                                                        if (
                                                            event.key === 'Enter' ||
                                                            event.key === ' '
                                                        ) {
                                                            event.preventDefault();
                                                            setDetail(row.userId);
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
                    }
                />
            )}
        </div>
    );
}
