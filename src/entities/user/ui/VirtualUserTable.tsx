import { createColumnHelper, flexRender, tableFeatures, useTable } from '@tanstack/react-table';
import { useMemo } from 'react';

import { badgeVariants } from '@shared/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@shared/ui/table';
import { cn } from '@shared/utils/cn';

import type { UserRole, VirtualUser } from '../model/types';

const ROLE_LABEL: Record<UserRole, string> = {
    USER: '사용자',
    ADMIN: '관리자',
};

// 상태·분류 칩 — 사용자 화면과 같은 공용 배지 모양(둥근 알약, 높이 26·글자 12)에 색만 칩마다 입힌다
const CHIP = badgeVariants({ variant: null });
// 칩만 담는 열 — 칩 너비가 제각각이라 왼쪽 정렬이면 들쭉날쭉해 보여 머리글과 함께 가운데로 맞춘다
const CENTER_COLUMNS = new Set<string>(['role', 'session']);

// 정렬·필터 기능 없이 행 모델만 쓰는 표시용 테이블 — 기능 슬롯을 등록하지 않아 번들도 가볍다
const features = tableFeatures({});
const helper = createColumnHelper<typeof features, VirtualUser>();

/**
 * 가상 사용자 조회 테이블 — 수정·삭제 기능이 없는 읽기 전용 표시다.
 * currentUserId는 지금 이 브라우저 세션으로 선택된 사용자를 표시하는 데 쓴다
 */
export function VirtualUserTable({
    users,
    currentUserId,
}: {
    users: VirtualUser[];
    currentUserId?: string | null;
}) {
    const columns = useMemo(
        () =>
            helper.columns([
                helper.accessor('name', {
                    header: '이름',
                    cell: ({ getValue }) => (
                        <span className="text-body-bold text-fg-primary">{getValue()}</span>
                    ),
                }),
                helper.accessor('id', {
                    header: '사용자 ID',
                    cell: ({ getValue }) => (
                        <span className="text-caption text-fg-secondary">{getValue()}</span>
                    ),
                }),
                helper.accessor('role', {
                    header: '역할',
                    cell: ({ getValue }) => (
                        <span
                            className={cn(
                                CHIP,
                                getValue() === 'ADMIN'
                                    ? 'bg-status-approved text-status-approved-text'
                                    : 'bg-surface-sunken text-fg-secondary',
                            )}
                        >
                            {ROLE_LABEL[getValue()]}
                        </span>
                    ),
                }),
                helper.accessor('personaLabel', {
                    header: '페르소나',
                    cell: ({ getValue }) => (
                        <span className="text-body-sm text-fg-secondary">{getValue() ?? '-'}</span>
                    ),
                }),
                helper.display({
                    id: 'session',
                    header: '현재 세션',
                    cell: ({ row }) =>
                        row.original.id === currentUserId ? (
                            <span
                                className={cn(CHIP, 'bg-status-pending text-status-pending-text')}
                            >
                                사용 중
                            </span>
                        ) : (
                            <span className="text-body-sm text-fg-secondary">-</span>
                        ),
                }),
            ]),
        [currentUserId],
    );

    const table = useTable({ features, columns, data: users });

    return (
        // 좁은 화면에서 표가 카드 밖으로 넘치면 카드 안쪽 가로 스크롤로 접근한다 — 스크롤 영역은
        // 키보드 진입이 가능해야 하므로 region+tabIndex를 둔다 (GD-317 어뷰징 표와 같은 패턴)
        <div
            role="region"
            aria-label="가상 사용자 표 가로 스크롤"
            tabIndex={0}
            className="bg-surface-page border-border-default focus-visible:ring-border-focus overflow-x-auto border-y focus-visible:ring-2 focus-visible:outline-none [&>[data-slot=table-container]]:overflow-visible"
        >
            <Table>
                <TableHeader>
                    {table.getHeaderGroups().map((headerGroup) => (
                        <TableRow key={headerGroup.id} className="hover:bg-transparent">
                            {headerGroup.headers.map((header) => (
                                <TableHead
                                    key={header.id}
                                    className={cn(
                                        'text-caption text-fg-tertiary h-11 px-4 font-semibold',
                                        CENTER_COLUMNS.has(header.column.id) && 'text-center',
                                    )}
                                >
                                    {flexRender(
                                        header.column.columnDef.header,
                                        header.getContext(),
                                    )}
                                </TableHead>
                            ))}
                        </TableRow>
                    ))}
                </TableHeader>
                <TableBody>
                    {table.getRowModel().rows.map((row) => (
                        <TableRow key={row.id} className="hover:bg-surface-sunken">
                            {row.getAllCells().map((cell) => (
                                <TableCell
                                    key={cell.id}
                                    className={cn(
                                        'px-4 py-3 align-middle',
                                        CENTER_COLUMNS.has(cell.column.id) && 'text-center',
                                    )}
                                >
                                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                </TableCell>
                            ))}
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </div>
    );
}
