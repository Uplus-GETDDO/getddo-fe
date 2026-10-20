import { useState } from 'react';

import {
    TicketConsistencyDrawer,
    TicketInconsistencyTable,
    useTicketInconsistencies,
} from '@entities/ticket';
import { PAGE_SIZE } from '@shared/lib/filterConstants';
import { Button } from '@shared/ui/button';
import { TextFilter } from '@shared/ui/filter-fields';
import { PagedResult } from '@shared/ui/paged-result';

export function InconsistencyTab() {
    const [page, setPage] = useState(1);
    const [userIdInput, setUserIdInput] = useState('');
    const [userId, setUserId] = useState('');
    // 사용자 직접 조회 — 목록에 나오지 않는 사용자(일치 사용자 포함)의 정합성도 확인한다
    const [lookupInput, setLookupInput] = useState('');
    const [drawerUserId, setDrawerUserId] = useState<string | null>(null);

    const query = useTicketInconsistencies({
        page,
        size: PAGE_SIZE,
        userId: userId || undefined,
    });

    return (
        <div className="flex flex-col gap-6">
            <div className="flex flex-wrap items-center gap-3">
                <form
                    className="flex flex-wrap items-center gap-2"
                    onSubmit={(e) => {
                        e.preventDefault();
                        setUserId(userIdInput.trim());
                        setPage(1);
                    }}
                >
                    <TextFilter
                        value={userIdInput}
                        onChange={setUserIdInput}
                        placeholder="사용자 ID로 거르기"
                        label="불일치 목록 사용자 ID"
                    />
                    <Button type="submit" variant="secondary">
                        검색
                    </Button>
                    <Button
                        type="button"
                        variant="ghost"
                        onClick={() => {
                            setUserIdInput('');
                            setUserId('');
                            setPage(1);
                        }}
                    >
                        초기화
                    </Button>
                </form>
                <form
                    className="flex flex-wrap items-center gap-2"
                    onSubmit={(e) => {
                        e.preventDefault();
                        const id = lookupInput.trim();
                        if (id) setDrawerUserId(id);
                    }}
                >
                    <TextFilter
                        value={lookupInput}
                        onChange={setLookupInput}
                        placeholder="사용자 ID 직접 조회"
                        label="사용자 직접 조회"
                    />
                    <Button type="submit" variant="secondary">
                        정합성 확인
                    </Button>
                </form>
            </div>

            <PagedResult
                data={query.data}
                isPending={query.isPending}
                isError={query.isError}
                isFetching={query.isFetching}
                updatedAt={query.dataUpdatedAt}
                page={page}
                onPageChange={setPage}
                emptyText="불일치한 응모권이 없습니다."
                errorText="불일치 목록을 불러오지 못했습니다."
                onRetry={() => void query.refetch()}
                emptyAction={
                    userId ? (
                        <Button
                            size="sm"
                            variant="ghost"
                            className="self-start"
                            onClick={() => {
                                setUserIdInput('');
                                setUserId('');
                                setPage(1);
                            }}
                        >
                            검색 조건 초기화
                        </Button>
                    ) : undefined
                }
            >
                {(rows) => (
                    <TicketInconsistencyTable
                        rows={rows}
                        onRowClick={(row) => setDrawerUserId(row.userId)}
                    />
                )}
            </PagedResult>

            <TicketConsistencyDrawer
                userId={drawerUserId}
                open={drawerUserId !== null}
                onOpenChange={(open) => {
                    if (!open) setDrawerUserId(null);
                }}
            />
        </div>
    );
}
