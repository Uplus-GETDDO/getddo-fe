import { createColumnHelper, flexRender, tableFeatures, useTable } from '@tanstack/react-table';
import { useMemo } from 'react';

import { Button } from '@shared/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@shared/ui/table';
import { cn } from '@shared/utils/cn';
import { formatKst } from '@shared/utils/date';

import type { AdminNotification } from '../model/types';

import { DeliveryStatusTag } from './NotificationTags';

// 정렬·필터는 서버 쿼리로 처리하므로 행 모델만 쓰는 표시용 테이블 — 기능 슬롯을 등록하지 않는다
const features = tableFeatures({});
const helper = createColumnHelper<typeof features, AdminNotification>();

/**
 * 개별 알림 모의 발송 이력 테이블. '발송 복구' 버튼은 retryable인 실패 건만 활성화하고
 * 실제 요청은 onRetry에 위임한다 (확인 다이얼로그는 feature 슬라이스의 책임).
 */
export function AdminNotificationTable({
    notifications,
    onRetry,
    onRowClick,
}: {
    notifications: AdminNotification[];
    onRetry?: (notification: AdminNotification) => void;
    onRowClick?: (notification: AdminNotification) => void;
}) {
    const columns = useMemo(
        () =>
            helper.columns([
                helper.accessor('mockDeliveryStatus', {
                    header: '상태',
                    cell: ({ getValue }) => <DeliveryStatusTag status={getValue()} />,
                }),
                // 어떤 알림을 누구에게 — 제목을 진하게, 받는 사람은 이름·ID 순으로
                helper.accessor('title', {
                    header: '알림',
                    cell: ({ getValue, row }) => (
                        <button
                            type="button"
                            title={getValue()}
                            aria-label={`${row.original.userId} 발송 상세`}
                            onClick={(e) => {
                                e.stopPropagation();
                                onRowClick?.(row.original);
                            }}
                            className="text-body-sm-bold text-fg-primary focus-visible:ring-border-focus block max-w-64 cursor-pointer truncate rounded-sm text-left hover:underline focus-visible:ring-2 focus-visible:outline-none"
                        >
                            {getValue()}
                        </button>
                    ),
                }),
                helper.accessor('userId', {
                    header: '받는 사람',
                    cell: ({ getValue, row }) => (
                        <span title={getValue()} className="block max-w-40 min-w-0">
                            <span className="text-body-sm text-fg-primary block truncate">
                                {row.original.userName ?? getValue()}
                            </span>
                            {row.original.userName && (
                                <span className="text-caption text-fg-tertiary block truncate">
                                    {getValue()}
                                </span>
                            )}
                        </span>
                    ),
                }),
                // 언제 보냈는지와 몇 번째 시도인지를 한 칸에 — 보내기 전이면 생성 시각을 보인다
                helper.display({
                    id: 'sent',
                    header: '발송',
                    cell: ({ row }) => (
                        <div className="flex flex-col whitespace-nowrap tabular-nums">
                            <span className="text-body-sm text-fg-primary">
                                {row.original.mockSentAt
                                    ? formatKst(row.original.mockSentAt)
                                    : '아직 안 보냄'}
                            </span>
                            <span className="text-caption text-fg-tertiary">
                                {row.original.deliveryAttemptCount}회 시도 · 생성{' '}
                                {formatKst(row.original.createdAt)}
                            </span>
                        </div>
                    ),
                }),
                // 복구 버튼은 지금 복구할 수 있는 건에만 — 못 하는 까닭은 상세에서 본다 (표가 글로 덮이지 않게)
                helper.display({
                    id: 'actions',
                    header: '',
                    cell: ({ row }) => (
                        <div className="flex items-center justify-end gap-1">
                            {row.original.retryable && (
                                <Button
                                    size="sm"
                                    variant="secondary"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onRetry?.(row.original);
                                    }}
                                >
                                    발송 복구
                                </Button>
                            )}
                        </div>
                    ),
                }),
            ]),
        [onRetry, onRowClick],
    );

    const table = useTable({ features, columns, data: notifications });

    return (
        <div className="bg-surface-page border-border-default overflow-hidden rounded-2xl border">
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
