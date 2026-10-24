import { createColumnHelper, flexRender, tableFeatures, useTable } from '@tanstack/react-table';
import { useMemo } from 'react';

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@shared/ui/table';
import { cn } from '@shared/utils/cn';
import { formatKst } from '@shared/utils/date';

import type { NotificationJob } from '../model/types';

import { NOTIFICATION_TYPE_LABEL } from '../model/types';
import { JobStatusTags } from './NotificationTags';

// 정렬·필터는 서버 쿼리로 처리하므로 행 모델만 쓰는 표시용 테이블 — 기능 슬롯을 등록하지 않는다
const features = tableFeatures({});
const helper = createColumnHelper<typeof features, NotificationJob>();

/**
 * 알림 생성 작업 테이블 — 행 클릭은 상세 드로어를 여는 onRowClick에 위임한다.
 * generationStoppedBy가 있는 작업은 상태 옆에 흐린 '자동 중단'을 함께 표시한다 (상태가 아니다).
 */
export function NotificationJobTable({
    jobs,
    onRowClick,
}: {
    jobs: NotificationJob[];
    onRowClick?: (job: NotificationJob) => void;
}) {
    const columns = useMemo(
        () =>
            helper.columns([
                helper.accessor('status', {
                    header: '상태',
                    cell: ({ getValue, row }) => (
                        <JobStatusTags
                            status={getValue()}
                            stopped={row.original.generationStoppedBy !== null}
                        />
                    ),
                }),
                // 무슨 알림인지를 진하게 — 이벤트 ID는 아래 작은 글로
                helper.accessor('notificationType', {
                    header: '알림',
                    cell: ({ getValue, row }) => (
                        <div className="flex max-w-64 min-w-0 flex-col">
                            <button
                                type="button"
                                aria-label={`${NOTIFICATION_TYPE_LABEL[getValue()]} 작업 상세`}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onRowClick?.(row.original);
                                }}
                                className="text-body-sm-bold text-fg-primary focus-visible:ring-border-focus cursor-pointer rounded-sm text-left hover:underline focus-visible:ring-2 focus-visible:outline-none"
                            >
                                {NOTIFICATION_TYPE_LABEL[getValue()]}
                            </button>
                            <span
                                title={row.original.eventId ?? undefined}
                                className="text-caption text-fg-tertiary truncate"
                            >
                                {row.original.eventId ?? '이벤트 없음'}
                            </span>
                        </div>
                    ),
                }),
                // 처리 횟수와 다음 재시도는 한 칸에 — 재시도가 없으면 횟수만
                helper.display({
                    id: 'attempt',
                    header: '처리',
                    cell: ({ row }) => (
                        <div className="flex flex-col whitespace-nowrap tabular-nums">
                            <span className="text-body-sm text-fg-primary">
                                {row.original.attemptCount}회
                            </span>
                            {row.original.nextAttemptAt && (
                                <span className="text-caption text-fg-tertiary">
                                    다음 {formatKst(row.original.nextAttemptAt)}
                                </span>
                            )}
                        </div>
                    ),
                }),
                helper.accessor('createdAt', {
                    header: '생성 시각',
                    cell: ({ getValue }) => (
                        <span className="text-fg-secondary text-body-sm whitespace-nowrap tabular-nums">
                            {formatKst(getValue())}
                        </span>
                    ),
                }),
                // 행 onClick만으로는 키보드가 상세를 열 수 없다 — 이름 있는 버튼으로 동일 경로를 제공한다
            ]),
        [onRowClick],
    );

    const table = useTable({ features, columns, data: jobs });

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
