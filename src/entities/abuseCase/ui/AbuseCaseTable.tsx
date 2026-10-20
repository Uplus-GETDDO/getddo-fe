import { createColumnHelper, flexRender, tableFeatures, useTable } from '@tanstack/react-table';
import { useMemo } from 'react';

import { badgeVariants } from '@shared/ui/badge';
import { Button } from '@shared/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@shared/ui/table';
import { cn } from '@shared/utils/cn';
import { formatKst } from '@shared/utils/date';

import type { AbuseCase } from '../model/types';

import { ABUSE_TARGET_LABEL, REWARD_SOURCE_LABEL } from '../model/types';

// 상태·분류 칩 — 사용자 화면과 같은 공용 배지 모양(둥근 알약, 높이 26·글자 12)에 색만 칩마다 입힌다
const CHIP = badgeVariants({ variant: null });
// 칩만 담는 열 — 칩 너비가 제각각이라 왼쪽 정렬이면 들쭉날쭉해 보여 머리글과 함께 가운데로 맞춘다
const CENTER_COLUMNS = new Set<string>(['target']);

const subjectOf = (abuseCase: AbuseCase) =>
    abuseCase.target === 'entry'
        ? (abuseCase.eventTitle ?? '-')
        : `${REWARD_SOURCE_LABEL[abuseCase.rewardSource ?? 'attendance']} 지급`;

// 정렬·필터 기능 없이 행 모델만 쓰는 표시용 테이블 — 기능 슬롯을 등록하지 않아 번들도 가볍다
const features = tableFeatures({});
const helper = createColumnHelper<typeof features, AbuseCase>();

/**
 * 어뷰징 차단 내역 테이블 — 지급 전 차단된 요청을 행 단위로 비교·조회하는 관리자 화면용 표시다.
 * 행 클릭과 상세 버튼은 상세 드로어를 여는 onRowClick에 위임한다
 */
export function AbuseCaseTable({
    cases,
    onRowClick,
}: {
    cases: AbuseCase[];
    onRowClick?: (abuseCase: AbuseCase) => void;
}) {
    const columns = useMemo(
        () =>
            helper.columns([
                helper.accessor('detectedAt', {
                    header: '발생 시각',
                    cell: ({ getValue }) => (
                        <span className="text-fg-secondary text-body-sm whitespace-nowrap">
                            {formatKst(getValue())}
                        </span>
                    ),
                }),
                helper.accessor('target', {
                    header: '구분',
                    cell: ({ getValue }) => (
                        <span className={cn(CHIP, 'bg-surface-sunken text-fg-secondary')}>
                            {ABUSE_TARGET_LABEL[getValue()]}
                        </span>
                    ),
                }),
                helper.display({
                    id: 'user',
                    header: '사용자',
                    cell: ({ row }) => (
                        <div className="flex flex-col">
                            <span className="text-body-sm text-fg-primary">
                                {row.original.userNickname}
                            </span>
                            <span className="text-caption text-fg-secondary">
                                {row.original.userId}
                            </span>
                        </div>
                    ),
                }),
                helper.display({
                    id: 'subject',
                    header: '대상',
                    cell: ({ row }) => (
                        <span className="text-body-sm text-fg-primary">
                            {subjectOf(row.original)}
                        </span>
                    ),
                }),
                helper.accessor('reason', {
                    header: '차단 사유',
                    cell: ({ getValue }) => (
                        // 긴 사유는 말줄임으로 잘라 표를 찢지 않고, 전체 문구는 title로 본다
                        <span
                            title={getValue()}
                            className="text-body-sm text-fg-primary block max-w-60 truncate"
                        >
                            {getValue()}
                        </span>
                    ),
                }),
                helper.accessor('requestSummary', {
                    header: '관련 요청',
                    cell: ({ getValue }) => (
                        <span
                            title={getValue()}
                            className="text-body-sm text-fg-secondary block max-w-50 truncate"
                        >
                            {getValue()}
                        </span>
                    ),
                }),
                helper.display({
                    id: 'detail',
                    header: '상세',
                    cell: ({ row }) => (
                        <Button
                            size="sm"
                            variant="ghost"
                            className="hover:bg-surface-pressed"
                            aria-label={`${row.original.userNickname} 차단 상세`}
                            onClick={(e) => {
                                e.stopPropagation();
                                onRowClick?.(row.original);
                            }}
                        >
                            상세
                        </Button>
                    ),
                }),
            ]),
        [onRowClick],
    );

    const table = useTable({ features, columns, data: cases });

    return (
        <div className="bg-surface-page border-border-default overflow-hidden rounded-2xl border">
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
                        <TableRow
                            key={row.id}
                            className={cn(
                                'hover:bg-surface-sunken focus-within:bg-surface-sunken',
                                onRowClick && 'cursor-pointer',
                            )}
                            onClick={() => onRowClick?.(row.original)}
                        >
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
