import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { z } from 'zod';

import { MEMBERSHIP_LABEL } from '@entities/event';
import { useAdminUser, useAdminUsers } from '@entities/user';
import { getErrorMessage } from '@shared/api/errorMessage';
import { ALL, orUndefined } from '@shared/model/filterConstants';
import { Badge } from '@shared/ui/badge';
import { Button } from '@shared/ui/button';
import { TextFilter } from '@shared/ui/filter-fields';
import { chipValue, FilterChips, FilterPanel, FilterRow } from '@shared/ui/filter-panel';
import { PagedResult } from '@shared/ui/paged-result';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@shared/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@shared/ui/table';
import { formatKstFullDot } from '@shared/utils/date';

import { USER_ROLE_LABEL } from './model/labels';
import { AdminUserDetailSheet } from './ui/AdminUserDetailSheet';
import { MembershipBadge, UserStatus } from './ui/UserBadges';

const SIZE_OPTIONS = [20, 50, 100];
const ROLE_OPTIONS = [
    { value: ALL, label: '전체' },
    { value: 'USER', label: '사용자' },
    { value: 'ADMIN', label: '관리자' },
];
const STATUS_OPTIONS = [
    { value: ALL, label: '전체' },
    { value: 'ACTIVE', label: '활성' },
    { value: 'INACTIVE', label: '비활성' },
];
const MEMBERSHIP_OPTIONS = [
    { value: ALL, label: '전체' },
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

    // 칩 조건은 누르는 즉시 걸고, 글자 검색만 검색 버튼으로 확정한다
    const applyChip = (value: Partial<typeof EMPTY>) => {
        patch(value);
        setApplied((current) => ({ ...current, ...value }));
        setPage(1);
    };
    const activeCount = (Object.keys(EMPTY) as (keyof typeof EMPTY)[]).filter(
        (key) => applied[key] !== EMPTY[key],
    ).length;

    return (
        <div className="flex flex-col gap-6 pr-10 pb-10">
            <div className="flex justify-end">
                <span className="bg-surface-page border-border-default text-body-sm-bold text-fg-primary rounded-full border px-3 py-1">
                    현재 활성 일반 사용자 {listQuery.data?.totalUserCount ?? '—'}명
                </span>
            </div>

            <FilterPanel
                search={
                    <TextFilter
                        value={draft.keyword}
                        onChange={(keyword) => patch({ keyword })}
                        placeholder="이름 또는 UUID로 검색"
                        label="이름·UUID 검색"
                        className="w-full"
                    />
                }
                onSubmit={() => {
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
                error={searchError}
                onReset={resetFilters}
                activeCount={activeCount}
            >
                <FilterRow
                    label="사용자 ID"
                    apply
                    value={applied.userId ? `${applied.userId.slice(0, 8)}…` : undefined}
                    onClear={() => applyChip({ userId: '' })}
                >
                    <TextFilter
                        value={draft.userId}
                        onChange={(userId) => patch({ userId })}
                        placeholder="UUID 전체"
                        label="사용자 ID 필터"
                        className="w-96 max-w-full"
                    />
                </FilterRow>
                <FilterRow
                    label="역할"
                    value={chipValue(ROLE_OPTIONS, applied.role)}
                    onClear={() => applyChip({ role: ALL })}
                >
                    <FilterChips
                        value={draft.role}
                        onChange={(role) => applyChip({ role })}
                        options={ROLE_OPTIONS}
                        label="역할"
                    />
                </FilterRow>
                <FilterRow
                    label="상태"
                    value={chipValue(STATUS_OPTIONS, applied.status)}
                    onClear={() => applyChip({ status: ALL })}
                >
                    <FilterChips
                        value={draft.status}
                        onChange={(status) => applyChip({ status })}
                        options={STATUS_OPTIONS}
                        label="상태"
                    />
                </FilterRow>
                <FilterRow
                    label="멤버십"
                    value={chipValue(MEMBERSHIP_OPTIONS, applied.membership)}
                    onClear={() => applyChip({ membership: ALL })}
                >
                    <FilterChips
                        value={draft.membership}
                        onChange={(membership) => applyChip({ membership })}
                        options={MEMBERSHIP_OPTIONS}
                        label="멤버십"
                    />
                </FilterRow>
            </FilterPanel>

            <PagedResult
                data={listQuery.data}
                isPending={listQuery.isPending}
                isError={listQuery.isError}
                isFetching={listQuery.isFetching}
                updatedAt={listQuery.dataUpdatedAt}
                page={page}
                onPageChange={setPage}
                emptyText="해당하는 사용자가 없습니다."
                errorText={getErrorMessage(listQuery.error, '사용자를 불러오지 못했습니다.')}
                onRetry={() => void listQuery.refetch()}
                toolbar={
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
                }
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
                    <div className="bg-surface-page border-border-default overflow-hidden rounded-2xl border">
                        <Table>
                            <TableHeader>
                                <TableRow className="hover:bg-transparent">
                                    <TableHead className="px-4">사용자</TableHead>
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
                                        {/* 이름과 ID는 한 사람의 정보라 한 칸에 — 따로 떨어져 있으면 행을 가로로 훑어야 했다 */}
                                        <TableCell className="px-4 py-3">
                                            <span className="text-body-sm-bold text-fg-primary block">
                                                {row.name}
                                            </span>
                                            <span className="text-caption text-fg-tertiary block">
                                                {row.id}
                                            </span>
                                        </TableCell>
                                        <TableCell>
                                            <Badge
                                                variant={row.role === 'ADMIN' ? 'info' : 'outline'}
                                            >
                                                {USER_ROLE_LABEL[row.role]}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>
                                            <UserStatus status={row.status} />
                                        </TableCell>
                                        <TableCell>
                                            <MembershipBadge membership={row.membership} />
                                        </TableCell>
                                        <TableCell className="text-fg-secondary text-body-sm tabular-nums">
                                            {formatKstFullDot(row.createdAt)}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
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
