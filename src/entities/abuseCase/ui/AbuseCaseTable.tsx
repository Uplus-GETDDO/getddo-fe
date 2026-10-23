import { createColumnHelper, flexRender, tableFeatures, useTable } from '@tanstack/react-table';
import { useMemo } from 'react';

import { badgeVariants } from '@shared/ui/badge';
import { Button } from '@shared/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@shared/ui/table';
import { cn } from '@shared/utils/cn';
import { formatKst } from '@shared/utils/date';

import type { AbuseCase } from '../model/types';

import { ABUSE_SOURCE_TYPE_LABEL } from '../model/types';

// 상태·분류 칩 — 사용자 화면과 같은 공용 배지 모양(둥근 알약, 높이 26·글자 12)에 색만 칩마다 입힌다
const CHIP = badgeVariants({ variant: null });
// 칩만 담는 열 — 칩 너비가 제각각이라 왼쪽 정렬이면 들쭉날쭉해 보여 머리글과 함께 가운데로 맞춘다
const CENTER_COLUMNS = new Set<string>(['sourceType']);

// 정렬·필터 기능 없이 행 모델만 쓰는 표시용 테이블 — 기능 슬롯을 등록하지 않아 번들도 가볍다
const features = tableFeatures({});
const helper = createColumnHelper<typeof features, AbuseCase>();

/**
 * 어뷰징 차단 내역 테이블 — 응모 요청의 자동 일시 차단 이력을 행 단위로 비교·조회하는 관리자 화면용 표시다.
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
                helper.accessor('blockedAt', {
                    header: '차단 시작',
                    cell: ({ getValue }) => (
                        <span className="text-fg-secondary text-body-sm whitespace-nowrap">
                            {formatKst(getValue())}
                        </span>
                    ),
                }),
                helper.accessor('blockedUntil', {
                    header: '차단 종료 예정',
                    cell: ({ getValue }) => (
                        <span className="text-fg-secondary text-body-sm whitespace-nowrap">
                            {formatKst(getValue())}
                        </span>
                    ),
                }),
                helper.accessor('sourceType', {
                    header: '구분',
                    cell: ({ getValue }) => (
                        <span className={cn(CHIP, 'bg-surface-sunken text-fg-secondary')}>
                            {ABUSE_SOURCE_TYPE_LABEL[getValue()]}
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
                    id: 'event',
                    header: '관련 이벤트',
                    cell: ({ row }) => (
                        <span className="text-body-sm text-fg-primary">
                            {row.original.eventTitle ?? '-'}
                        </span>
                    ),
                }),
                helper.accessor('detectionReason', {
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
        // 좁은 화면에서 표가 카드 밖으로 넘치면 카드 안쪽 가로 스크롤로 접근한다 — 스크롤 영역은
        // 키보드 진입이 가능해야 하므로 region+tabIndex를 둔다 (GD-316 감사 표와 같은 패턴)
        <div
            role="region"
            aria-label="차단 내역 표 가로 스크롤"
            tabIndex={0}
            className="bg-surface-page border-border-default focus-visible:ring-border-focus overflow-x-auto rounded-2xl border focus-visible:ring-2 focus-visible:outline-none [&>[data-slot=table-container]]:overflow-visible"
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
