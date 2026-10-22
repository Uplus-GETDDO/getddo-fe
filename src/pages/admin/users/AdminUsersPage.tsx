import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { z } from 'zod';

import { MEMBERSHIP_LABEL } from '@entities/event';
import { useAdminUser, useAdminUsers } from '@entities/user';
import { getErrorMessage } from '@shared/api/errorMessage';
import { ALL, orUndefined } from '@shared/model/filterConstants';
import { Button } from '@shared/ui/button';
import { OptionFilter, TextFilter } from '@shared/ui/filter-fields';
import { PagedResult } from '@shared/ui/paged-result';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@shared/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@shared/ui/table';
import { formatKstDot } from '@shared/utils/date';

import { USER_ROLE_LABEL, USER_STATUS_LABEL } from './model/labels';
import { AdminUserDetailSheet } from './ui/AdminUserDetailSheet';

const SIZE_OPTIONS = [20, 50, 100];
const ROLE_OPTIONS = [
    { value: ALL, label: '전체 역할' },
    { value: 'USER', label: '사용자' },
    { value: 'ADMIN', label: '관리자' },
];
const STATUS_OPTIONS = [
    { value: ALL, label: '전체 상태' },
    { value: 'ACTIVE', label: '활성' },
    { value: 'INACTIVE', label: '비활성' },
];
const MEMBERSHIP_OPTIONS = [
    { value: ALL, label: '전체 멤버십' },
    ...Object.entries(MEMBERSHIP_LABEL).map(([value, label]) => ({ value, label })),
];

const EMPTY = { keyword: '', userId: '', role: ALL, status: ALL, membership: ALL };

// AO01/AO02 — DB 사용자 조회. 가상 사용자(/virtual-users)와 별개의 관리자 조회다
export function AdminUsersPage() {
    const [searchParams, setSearchParams] = useSearchParams();
    const detailId = searchParams.get('detail');
    const validDetailId = detailId && z.uuid().safeParse(detailId).success ? detailId : null;

    const [page, setPage] = useState(1);
    const [size, setSize] = useState(20);
    const [draft, setDraft] = useState(EMPTY);
    const [applied, setApplied] = useState(EMPTY);
    const [searchError, setSearchError] = useState<string | null>(null);
    const hasAppliedFilters = JSON.stringify(applied) !== JSON.stringify(EMPTY);
    const resetFilters = () => {
        setDraft(EMPTY);
        setApplied(EMPTY);
        setSearchError(null);
        setPage(1);
    };
    const patch = (value: Partial<typeof EMPTY>) => setDraft((d) => ({ ...d, ...value }));

    const listQuery = useAdminUsers({
        page,
        size,
        userId: applied.userId || undefined,
        keyword: applied.keyword || undefined,
        role: orUndefined(applied.role) as 'USER' | 'ADMIN' | undefined,
        status: orUndefined(applied.status) as 'ACTIVE' | 'INACTIVE' | undefined,
        membership: orUndefined(applied.membership) as 'excellent' | 'vip' | 'vvip' | undefined,
    });
    const detailQuery = useAdminUser(validDetailId);

    const closeDetail = () => {
        const next = new URLSearchParams(searchParams);
        next.delete('detail');
        setSearchParams(next);
    };

    return (
        <div className="flex flex-col gap-6 pr-10 pb-10">
            {/* 화면 이름은 관리자 레이아웃 위쪽 바가 이미 띄운다 — 본문에서 또 적지 않고 설명만 둔다 */}
            <p className="text-body-sm text-fg-secondary">
                데이터베이스에 등록된 사용자를 검색하고 운영 정보로 연결합니다.
            </p>

            <form
                className="flex flex-wrap items-center gap-2"
                onSubmit={(e) => {
                    e.preventDefault();
                    const trimmedId = draft.userId.trim();
                    if (trimmedId && !z.uuid().safeParse(trimmedId).success) {
                        setSearchError('올바른 UUID 형식이 아닙니다.');
                        return;
                    }
                    const keyword = draft.keyword.trim();
                    // UUID 형태의 검색어는 keyword(최대 20자)가 아니라 userId 필터로 라우팅한다
                    const keywordIsUuid = z.uuid().safeParse(keyword).success;
                    if (!keywordIsUuid && keyword.length > 20) {
                        setSearchError('검색어는 20자 이하여야 합니다.');
                        return;
                    }
                    setSearchError(null);
                    setApplied({
                        ...draft,
                        userId: trimmedId || (keywordIsUuid ? keyword : ''),
                        keyword: keywordIsUuid ? '' : keyword,
                    });
                    setPage(1);
                }}
            >
                <TextFilter
                    value={draft.keyword}
                    onChange={(keyword) => patch({ keyword })}
                    placeholder="이름 또는 UUID"
                    label="이름·UUID 검색"
                />
                <TextFilter
                    value={draft.userId}
                    onChange={(userId) => patch({ userId })}
                    placeholder="사용자 ID"
                    label="사용자 ID 필터"
                />
                <OptionFilter
                    value={draft.role}
                    onChange={(role) => patch({ role })}
                    options={ROLE_OPTIONS}
                    label="역할 필터"
                />
                <OptionFilter
                    value={draft.status}
                    onChange={(status) => patch({ status })}
                    options={STATUS_OPTIONS}
                    label="상태 필터"
                />
                <OptionFilter
                    value={draft.membership}
                    onChange={(membership) => patch({ membership })}
                    options={MEMBERSHIP_OPTIONS}
                    label="멤버십 필터"
                />
                <Button type="submit" variant="secondary">
                    검색
                </Button>
                <Button type="button" variant="ghost" onClick={resetFilters}>
                    초기화
                </Button>
                {searchError && (
                    <p role="alert" className="text-semantic-error-strong text-caption basis-full">
                        {searchError}
                    </p>
                )}
            </form>

            {/* 재조회 중에도 행이 사라지지 않게 값만 비운다 */}
            <div className="flex items-center gap-4">
                <p className="text-body-sm text-fg-secondary">
                    현재 활성 일반 사용자 {listQuery.data?.totalUserCount ?? '—'}명
                </p>
                <Select
                    value={String(size)}
                    onValueChange={(v) => {
                        setSize(Number(v));
                        setPage(1);
                    }}
                >
                    <SelectTrigger className="w-28" aria-label="페이지 크기">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        {SIZE_OPTIONS.map((n) => (
                            <SelectItem key={n} value={String(n)}>
                                {n}개씩
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            <PagedResult
                data={listQuery.data}
                isPending={listQuery.isPending}
                isError={listQuery.isError}
                isFetching={listQuery.isFetching}
                page={page}
                onPageChange={setPage}
                emptyText="해당하는 사용자가 없습니다."
                errorText={getErrorMessage(listQuery.error, '사용자를 불러오지 못했습니다.')}
                onRetry={() => void listQuery.refetch()}
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
                                <TableHead>이름</TableHead>
                                <TableHead>사용자 ID</TableHead>
                                <TableHead>역할</TableHead>
                                <TableHead>상태</TableHead>
                                <TableHead>멤버십</TableHead>
                                <TableHead>가입일</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {rows.map((row) => (
                                <TableRow
                                    key={row.id}
                                    className="cursor-pointer"
                                    role="button"
                                    tabIndex={0}
                                    onClick={() => setSearchParams({ detail: row.id })}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' || e.key === ' ') {
                                            e.preventDefault();
                                            setSearchParams({ detail: row.id });
                                        }
                                    }}
                                >
                                    <TableCell className="font-medium">{row.name}</TableCell>
                                    <TableCell className="text-fg-secondary text-caption">
                                        {row.id}
                                    </TableCell>
                                    <TableCell>{USER_ROLE_LABEL[row.role]}</TableCell>
                                    <TableCell>{USER_STATUS_LABEL[row.status]}</TableCell>
                                    <TableCell>
                                        {row.membership
                                            ? MEMBERSHIP_LABEL[row.membership]
                                            : '미설정'}
                                    </TableCell>
                                    <TableCell className="text-fg-secondary text-body-sm">
                                        {formatKstDot(row.createdAt)}
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                )}
            </PagedResult>

            <AdminUserDetailSheet
                userId={validDetailId}
                user={detailQuery.data}
                isPending={detailQuery.isPending}
                error={detailQuery.error}
                onClose={closeDetail}
            />
        </div>
    );
}
