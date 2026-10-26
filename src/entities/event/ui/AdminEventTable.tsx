import { createColumnHelper, flexRender, tableFeatures, useTable } from '@tanstack/react-table';
import { useMemo } from 'react';

import { badgeVariants } from '@shared/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@shared/ui/table';
import { cn } from '@shared/utils/cn';
import { formatKst } from '@shared/utils/date';

import type { AdminEvent } from '../model/adminTypes';

import { ADMIN_STATUS_META, MEMBERSHIP_LABEL } from '../model/adminStatusMeta';

// 상태·분류 칩 — 사용자 화면과 같은 공용 배지 모양(둥근 알약, 높이 26·글자 12)에 색만 칩마다 입힌다
const CHIP = badgeVariants({ variant: null });
// 칩만 담는 열 — 칩 너비가 제각각이라 왼쪽 정렬이면 들쭉날쭉해 보여 머리글과 함께 가운데로 맞춘다
// 표에서는 계약 값 대신 서비스 이름으로 — 등록 화면·목록 필터와 같은 말
const KIND_LABEL = { TICKET: '겟또타임', NO_TICKET: '일반' } as const;

// 좁은 칸 모드에서 남기는 열
const COMPACT_COLUMNS = new Set(['title', 'status', 'detail']);

const KST_YMD_HM: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
};

// 정렬·필터 기능 없이 행 모델만 쓰는 표시용 테이블 — 필터·페이지는 페이지가 서버로 넘긴다
const features = tableFeatures({});
const helper = createColumnHelper<typeof features, AdminEvent>();

/**
 * 관리자 이벤트 목록 테이블 — 행 클릭으로 상세로 이동한다.
 * 운영 액션(수정·취소·삭제 등)은 상세 화면에 모아 목록 행을 가볍게 둔다
 * 행 onClick만으로는 키보드가 상세를 열 수 없으므로 '상세' 버튼 열로 동일 경로를 제공한다
 */
export function AdminEventTable({
    events,
    onRowClick,
    compact = false,
    selectedId,
}: {
    events: AdminEvent[];
    onRowClick?: (event: AdminEvent) => void;
    /** 오른쪽에 상세가 열려 칸이 좁을 때 — 이벤트·상태·상세 열만 남긴다 */
    compact?: boolean;
    /** 상세가 열린 줄 — 바탕으로 표시한다 */
    selectedId?: string;
}) {
    const columns = useMemo(
        () =>
            helper.columns([
                // 운영자가 먼저 훑는 건 지금 상태 — 맨 앞 색 칩으로 둔다
                helper.accessor('status', {
                    header: '상태',
                    cell: ({ getValue }) => {
                        const status = ADMIN_STATUS_META[getValue()];
                        return (
                            <span className={cn(CHIP, 'whitespace-nowrap', status.chipClass)}>
                                {status.label}
                            </span>
                        );
                    },
                }),
                // 이름을 진하게, 종류(겟또타임·일반)와 응모권 방식은 이름 아래 한 줄로 — 따로 열을 두면 표가 넓어지기만 했다
                helper.accessor('title', {
                    header: '이벤트',
                    cell: ({ row, getValue }) => (
                        <div className="flex max-w-72 min-w-0 flex-col gap-0.5">
                            {/* 이름이 곧 상세 열기 — 줄 끝 '>' 칸은 어디를 눌러야 하는지 애매했다 */}
                            <button
                                type="button"
                                aria-label={`${getValue()} 상세`}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onRowClick?.(row.original);
                                }}
                                className="text-body-sm-bold text-fg-primary focus-visible:ring-border-focus cursor-pointer truncate rounded-sm text-left hover:underline focus-visible:ring-2 focus-visible:outline-none"
                            >
                                {getValue()}
                            </button>
                            {/* 종류는 칩 대신 회색 한 줄 — 줄마다 색 칩이 붙으면 이름보다 칩이 먼저 보이고 줄 높이가 들쭉날쭉했다 */}
                            <span className="text-caption text-fg-tertiary truncate">
                                {KIND_LABEL[row.original.eventType]}
                                {row.original.eventType === 'TICKET' &&
                                    ` · ${
                                        row.original.weightingEnabled
                                            ? `가중치 · ${row.original.maxTicketsPerUser === null ? '상한 없음' : `최대 ${row.original.maxTicketsPerUser}장`}`
                                            : '1장 고정'
                                    }`}
                            </span>
                        </div>
                    ),
                }),
                helper.display({
                    id: 'period',
                    header: '응모 기간',
                    cell: ({ row }) => (
                        <div className="flex flex-col whitespace-nowrap tabular-nums">
                            <span className="text-body-sm text-fg-primary">
                                {formatKst(row.original.startsAt, KST_YMD_HM)}
                            </span>
                            <span className="text-caption text-fg-tertiary">
                                ~ {formatKst(row.original.endsAt, KST_YMD_HM)}
                            </span>
                        </div>
                    ),
                }),
                helper.accessor('membershipRule', {
                    header: '최소 등급',
                    cell: ({ getValue }) => (
                        <span className="text-body-sm text-fg-primary whitespace-nowrap">
                            {MEMBERSHIP_LABEL[getValue()]} 이상
                        </span>
                    ),
                }),
                helper.accessor('prizes', {
                    header: '경품',
                    cell: ({ getValue }) => {
                        const prizes = getValue();
                        const winners = prizes.reduce((sum, p) => sum + p.winnerCount, 0);
                        return (
                            <span
                                title={prizes.map((p) => `${p.rank}등 ${p.name}`).join(', ')}
                                className="text-body-sm text-fg-primary block max-w-44 truncate"
                            >
                                {prizes.length}종 · 총 {winners}명
                            </span>
                        );
                    },
                }),
                helper.accessor('createdAt', {
                    header: '등록일',
                    cell: ({ getValue }) => (
                        <span className="text-body-sm text-fg-secondary whitespace-nowrap tabular-nums">
                            {formatKst(getValue(), {
                                year: 'numeric',
                                month: '2-digit',
                                day: '2-digit',
                            })}
                        </span>
                    ),
                }),
            ]),
        [onRowClick],
    );

    const visibleColumns = useMemo(
        () =>
            compact
                ? // accessor 열은 정의 단계에서 id 대신 accessorKey만 갖는다
                  columns.filter((column) =>
                      COMPACT_COLUMNS.has(
                          column.id ?? ('accessorKey' in column ? String(column.accessorKey) : ''),
                      ),
                  )
                : columns,
        [columns, compact],
    );
    const table = useTable({ features, columns: visibleColumns, data: events });

    return (
        <div className="bg-surface-page border-border-default overflow-hidden border-y">
            <Table>
                <TableHeader>
                    {table.getHeaderGroups().map((headerGroup) => (
                        <TableRow key={headerGroup.id} className="hover:bg-transparent">
                            {headerGroup.headers.map((header) => (
                                <TableHead
                                    key={header.id}
                                    className="text-fg-tertiary h-11 px-4 text-xs font-semibold whitespace-nowrap"
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
                        <TableRow
                            key={row.id}
                            onClick={() => onRowClick?.(row.original)}
                            aria-selected={
                                selectedId === undefined
                                    ? undefined
                                    : row.original.id === selectedId
                            }
                            className={cn(
                                'hover:bg-surface-sunken focus-within:bg-surface-sunken',
                                onRowClick && 'cursor-pointer',
                                row.original.id === selectedId &&
                                    'bg-surface-sunken hover:bg-surface-sunken focus-within:bg-surface-sunken [&>td:first-child]:shadow-[inset_3px_0_0_var(--color-fg-primary)]',
                            )}
                        >
                            {row.getAllCells().map((cell) => (
                                <TableCell key={cell.id} className="px-4 py-3 align-middle">
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
