import { createColumnHelper, flexRender, tableFeatures, useTable } from '@tanstack/react-table';
import { useMemo } from 'react';

import { badgeVariants } from '@shared/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@shared/ui/table';
import { cn } from '@shared/utils/cn';
import { formatKst } from '@shared/utils/date';

import type { AbuseCase } from '../model/types';

import { ABUSE_SOURCE_TYPE_LABEL } from '../model/types';

// 상태·분류 칩 — 사용자 화면과 같은 공용 배지 모양(둥근 알약, 높이 26·글자 12)에 색만 칩마다 입힌다
const CHIP = badgeVariants({ variant: null });

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
                // 누가 막혔는지가 가장 먼저 — 닉네임을 진하게, ID는 아래 작은 글로
                helper.display({
                    id: 'user',
                    header: '사용자',
                    cell: ({ row }) => (
                        <div className="flex min-w-0 flex-col">
                            <button
                                type="button"
                                aria-label={`${row.original.userNickname} 차단 상세`}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onRowClick?.(row.original);
                                }}
                                className="text-body-sm-bold text-fg-primary focus-visible:ring-border-focus cursor-pointer rounded-sm text-left hover:underline focus-visible:ring-2 focus-visible:outline-none"
                            >
                                {row.original.userNickname}
                            </button>
                            <span className="text-caption text-fg-tertiary">
                                {row.original.userId}
                            </span>
                        </div>
                    ),
                }),
                helper.accessor('detectionReason', {
                    header: '차단 사유',
                    cell: ({ row, getValue }) => (
                        // 긴 사유는 말줄임으로 잘라 표를 찢지 않고, 전체 문구는 title로 본다
                        <div className="flex min-w-0 flex-col items-start gap-1">
                            <span
                                title={getValue()}
                                className="text-body-sm text-fg-primary block max-w-72 truncate"
                            >
                                {getValue()}
                            </span>
                            <span className={cn(CHIP, 'bg-surface-sunken text-fg-secondary')}>
                                {ABUSE_SOURCE_TYPE_LABEL[row.original.sourceType]}
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
                // 시작·종료를 한 칸에 — 두 칸으로 떨어져 있으면 얼마나 막혔는지 바로 읽히지 않는다
                helper.display({
                    id: 'period',
                    header: '차단 기간',
                    cell: ({ row }) => (
                        <div className="flex flex-col whitespace-nowrap">
                            <span className="text-body-sm text-fg-primary tabular-nums">
                                {formatKst(row.original.blockedAt)}
                            </span>
                            <span className="text-caption text-fg-tertiary tabular-nums">
                                ~ {formatKst(row.original.blockedUntil)}
                            </span>
                        </div>
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
                                    className="text-fg-tertiary h-11 px-4 text-xs font-semibold"
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
