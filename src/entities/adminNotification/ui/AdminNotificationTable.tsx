import { createColumnHelper, flexRender, tableFeatures, useTable } from '@tanstack/react-table';
import { useMemo } from 'react';

import { badgeVariants } from '@shared/ui/badge';
import { Button } from '@shared/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@shared/ui/table';
import { cn } from '@shared/utils/cn';
import { formatKst } from '@shared/utils/date';

import type { AdminNotification, MockDeliveryStatus } from '../model/types';

import { deliveryRetryBlockReason } from '../model/deliveryRetryReason';
import { MOCK_DELIVERY_STATUS_LABEL } from '../model/types';

// 상태·분류 칩 — 사용자 화면과 같은 공용 배지 모양(둥근 알약, 높이 26·글자 12)에 색만 칩마다 입힌다
const CHIP = badgeVariants({ variant: null });
// 칩만 담는 열 — 칩 너비가 제각각이라 왼쪽 정렬이면 들쭉날쭉해 보여 머리글과 함께 가운데로 맞춘다
const CENTER_COLUMNS = new Set<string>(['mockDeliveryStatus']);

const STATUS_CHIP: Record<MockDeliveryStatus, string> = {
    PENDING: 'bg-status-revision text-status-revision-text',
    SENT: 'bg-status-approved text-status-approved-text',
    FAILED: 'bg-status-rejected text-status-rejected-text',
};

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
                helper.accessor('createdAt', {
                    header: '생성 시각',
                    cell: ({ getValue }) => (
                        <span className="text-fg-secondary text-body-sm whitespace-nowrap">
                            {formatKst(getValue())}
                        </span>
                    ),
                }),
                helper.accessor('title', {
                    header: '알림',
                    cell: ({ getValue, row }) => (
                        <div className="flex flex-col">
                            <span
                                title={getValue()}
                                className="text-body-sm text-fg-primary max-w-56 truncate"
                            >
                                {getValue()}
                            </span>
                            <span
                                title={row.original.id}
                                className="text-caption text-fg-secondary max-w-56 truncate"
                            >
                                {row.original.id}
                            </span>
                        </div>
                    ),
                }),
                helper.accessor('userId', {
                    header: '사용자',
                    cell: ({ getValue }) => (
                        <span
                            title={getValue()}
                            className="text-body-sm text-fg-primary block max-w-32 truncate"
                        >
                            {getValue()}
                        </span>
                    ),
                }),
                helper.accessor('jobId', {
                    header: '작업',
                    cell: ({ getValue }) => (
                        <span
                            title={getValue()}
                            className="text-body-sm text-fg-secondary block max-w-32 truncate"
                        >
                            {getValue()}
                        </span>
                    ),
                }),
                helper.accessor('mockDeliveryStatus', {
                    header: '발송 상태',
                    cell: ({ getValue }) => (
                        <span className={cn(CHIP, STATUS_CHIP[getValue()])}>
                            {MOCK_DELIVERY_STATUS_LABEL[getValue()]}
                        </span>
                    ),
                }),
                helper.accessor('deliveryAttemptCount', {
                    header: '발송 차수',
                    cell: ({ getValue }) => (
                        <span className="text-body-sm text-fg-primary tabular-nums">
                            {getValue()}회
                        </span>
                    ),
                }),
                helper.accessor('mockSentAt', {
                    header: '발송 시각',
                    cell: ({ getValue }) => {
                        const sentAt = getValue();
                        return (
                            <span className="text-fg-secondary text-body-sm whitespace-nowrap">
                                {sentAt ? formatKst(sentAt) : '-'}
                            </span>
                        );
                    },
                }),
                // retryable은 서버가 계산한 복구 가능 여부 — FAILED라도 자동 재시도 대기·중지 건은 비활성이다
                helper.display({
                    id: 'retry',
                    header: '복구',
                    cell: ({ row }) => {
                        const blockReason = deliveryRetryBlockReason(row.original);
                        const reasonId = `delivery-retry-block-${row.original.id}`;
                        return (
                            <div className="flex max-w-40 flex-col gap-1">
                                <Button
                                    size="sm"
                                    variant="secondary"
                                    disabled={!row.original.retryable}
                                    aria-describedby={blockReason ? reasonId : undefined}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onRetry?.(row.original);
                                    }}
                                >
                                    발송 복구
                                </Button>
                                {blockReason && (
                                    <span id={reasonId} className="text-caption text-fg-tertiary">
                                        {blockReason}
                                    </span>
                                )}
                            </div>
                        );
                    },
                }),
                // 행 onClick만으로는 키보드가 상세를 열 수 없다 — 이름 있는 버튼으로 동일 경로를 제공한다
                helper.display({
                    id: 'detail',
                    header: '상세',
                    cell: ({ row }) => (
                        <Button
                            size="sm"
                            variant="ghost"
                            className="hover:bg-surface-pressed"
                            aria-label={`${row.original.userId} 발송 상세`}
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
