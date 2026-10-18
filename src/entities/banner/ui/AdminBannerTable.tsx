import { createColumnHelper, flexRender, tableFeatures, useTable } from '@tanstack/react-table';
import { ArrowDown, ArrowUp } from 'lucide-react';
import { useMemo, useState } from 'react';

import { Button } from '@shared/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@shared/ui/table';
import { formatKst } from '@shared/utils/date';

import type { AdminBanner } from '../model/types';

// 정렬·필터 기능 없이 행 모델만 쓰는 표시용 테이블 — 기능 슬롯을 등록하지 않아 번들도 가볍다
const features = tableFeatures({});
const helper = createColumnHelper<typeof features, AdminBanner>();

function BannerThumbnail({ src, label }: { src: string; label: string }) {
    // 이미지 변환 계약 전이라 imageUrl이 열리지 않을 수 있다 — 깨진 이미지 대신 자리표시자를 보인다
    const [failedSrc, setFailedSrc] = useState<string | null>(null);

    if (failedSrc === src) {
        return (
            <div className="bg-surface-sunken text-caption text-fg-secondary flex h-12 w-24 items-center justify-center rounded-md">
                이미지 없음
            </div>
        );
    }
    return (
        <img
            src={src}
            alt={`${label} 배너 이미지`}
            onError={() => setFailedSrc(src)}
            className="bg-surface-sunken h-12 w-24 rounded-md object-cover"
        />
    );
}

interface AdminBannerTableProps {
    banners: AdminBanner[];
    /** 연결 이벤트 제목 — 배너 응답은 eventId만 주므로 호출부가 이벤트 목록으로 해석해 넘긴다 */
    eventTitleOf: (eventId: string | null) => string;
    onMove: (banner: AdminBanner, direction: 'up' | 'down') => void;
    onEdit: (banner: AdminBanner) => void;
    onDelete: (banner: AdminBanner) => void;
    /** 순서 변경 요청 중에는 이동 버튼을 잠근다 */
    disabled?: boolean;
}

/** 관리자 배너 목록 — 노출 순서대로 보여주고 행마다 순서 이동·수정·삭제 버튼을 둔다 */
export function AdminBannerTable({
    banners,
    eventTitleOf,
    onMove,
    onEdit,
    onDelete,
    disabled,
}: AdminBannerTableProps) {
    const columns = useMemo(
        () =>
            helper.columns([
                helper.display({
                    id: 'order',
                    header: '순서',
                    cell: ({ row }) => (
                        <span className="text-body-bold text-fg-primary">
                            {row.original.displayOrder}
                        </span>
                    ),
                }),
                helper.accessor('imageUrl', {
                    header: '이미지',
                    cell: ({ row }) => (
                        <BannerThumbnail
                            src={row.original.imageUrl}
                            label={eventTitleOf(row.original.eventId)}
                        />
                    ),
                }),
                helper.accessor('eventId', {
                    header: '연결 이벤트',
                    cell: ({ getValue }) => (
                        <span className="text-body-sm text-fg-primary">
                            {eventTitleOf(getValue())}
                        </span>
                    ),
                }),
                helper.accessor('imageKey', {
                    header: '이미지 키',
                    cell: ({ getValue }) => (
                        <span
                            title={getValue()}
                            className="text-caption text-fg-tertiary block max-w-48 truncate"
                        >
                            {getValue()}
                        </span>
                    ),
                }),
                helper.accessor('updatedAt', {
                    header: '수정일',
                    cell: ({ getValue }) => (
                        <span className="text-body-sm text-fg-secondary whitespace-nowrap">
                            {formatKst(getValue(), {
                                year: 'numeric',
                                month: '2-digit',
                                day: '2-digit',
                            })}
                        </span>
                    ),
                }),
                helper.display({
                    id: 'move',
                    header: '순서 변경',
                    cell: ({ row, table }) => {
                        const title = eventTitleOf(row.original.eventId);
                        const last = table.getRowModel().rows.length - 1;
                        return (
                            <div className="flex gap-2">
                                <Button
                                    size="icon"
                                    variant="ghost"
                                    className="hover:bg-surface-pressed"
                                    aria-label={`${title} 배너 순서 올리기`}
                                    disabled={disabled || row.index === 0}
                                    onClick={() => onMove(row.original, 'up')}
                                >
                                    <ArrowUp aria-hidden />
                                </Button>
                                <Button
                                    size="icon"
                                    variant="ghost"
                                    className="hover:bg-surface-pressed"
                                    aria-label={`${title} 배너 순서 내리기`}
                                    disabled={disabled || row.index === last}
                                    onClick={() => onMove(row.original, 'down')}
                                >
                                    <ArrowDown aria-hidden />
                                </Button>
                            </div>
                        );
                    },
                }),
                helper.display({
                    id: 'detail',
                    header: '관리',
                    cell: ({ row }) => {
                        const title = eventTitleOf(row.original.eventId);
                        return (
                            <div className="flex gap-1">
                                <Button
                                    size="sm"
                                    variant="ghost"
                                    className="hover:bg-surface-pressed"
                                    aria-label={`${title} 배너 수정`}
                                    onClick={() => onEdit(row.original)}
                                >
                                    수정
                                </Button>
                                <Button
                                    size="sm"
                                    variant="destructive"
                                    aria-label={`${title} 배너 삭제`}
                                    onClick={() => onDelete(row.original)}
                                >
                                    삭제
                                </Button>
                            </div>
                        );
                    },
                }),
            ]),
        [eventTitleOf, onMove, onEdit, onDelete, disabled],
    );

    const table = useTable({ features, columns, data: banners });

    return (
        <div className="bg-surface-page border-border-default overflow-hidden rounded-2xl border">
            <Table>
                <TableHeader>
                    {table.getHeaderGroups().map((headerGroup) => (
                        <TableRow key={headerGroup.id} className="hover:bg-transparent">
                            {headerGroup.headers.map((header) => (
                                <TableHead
                                    key={header.id}
                                    className="text-caption text-fg-tertiary h-11 px-4 font-semibold"
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
                            className="hover:bg-surface-sunken focus-within:bg-surface-sunken"
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
