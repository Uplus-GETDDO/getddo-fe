import { createColumnHelper, flexRender, tableFeatures, useTable } from '@tanstack/react-table';
import { motion } from 'framer-motion';
import { GripVertical } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';

import { Button } from '@shared/ui/button';
import { Table, TableCell, TableHead, TableHeader, TableRow } from '@shared/ui/table';
import { cn } from '@shared/utils/cn';
import { formatKst } from '@shared/utils/date';
import { startsOnOwnControl } from '@shared/utils/pointerTarget';

import type { AdminBanner } from '../model/types';

import { moveItem, rowIndexAt, sameOrder } from '../utils/dropOrder';

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
    /** 끌어 놓기로 정한 전체 순서 — 놓는 순간 한 번만 부른다 */
    onReorder: (bannerIds: string[]) => void;
    onEdit: (banner: AdminBanner) => void;
    onDelete: (banner: AdminBanner) => void;
    /** 순서 변경 요청 중에는 이동 버튼을 잠근다 */
    disabled?: boolean;
}

/** 관리자 배너 목록 — 노출 순서대로 보여주고 끌어 놓기와 이동 버튼으로 순서를 바꾼다 */
export function AdminBannerTable({
    banners,
    eventTitleOf,
    onMove,
    onReorder,
    onEdit,
    onDelete,
    disabled,
}: AdminBannerTableProps) {
    /*
     * 끄는 동안의 순서는 화면이 들고 있는다. 다른 행 위로 넘어가면 그 자리를 내주며 밀려나고,
     * 손을 뗀 순간에만 서버로 보낸다 — 지날 때마다 보내면 요청이 쏟아진다.
     * 서버가 새 목록을 주면 그쪽을 따르므로 실패해도 저장된 순서로 되돌아온다.
     */
    const [order, setOrder] = useState(banners);
    const [syncedFrom, setSyncedFrom] = useState(banners);
    if (syncedFrom !== banners) {
        setSyncedFrom(banners);
        setOrder(banners);
    }

    const [heldId, setHeldId] = useState<string | null>(null);
    const bodyRef = useRef<HTMLTableSectionElement>(null);

    const columns = useMemo(
        () =>
            helper.columns([
                /*
                 * 끌 손잡이와 자리 번호를 맨 앞 한 칸에 — 손잡이가 끝에 있으면 '끌어 옮기는 표'라는 게 늦게 보였다.
                 * 실제로 잡는 자리는 행 전체이고, 이 버튼은 마우스를 못 쓰는 경우의 유일한 길이라 방향키를 받는다.
                 * 번호는 저장된 값이 아니라 목록 안의 자리를 센다 — 끄는 동안에도 숫자가 바로 따라온다
                 */
                helper.display({
                    id: 'order',
                    header: () => <span className="block pl-10">순서</span>,
                    cell: ({ row }) => {
                        const title = eventTitleOf(row.original.eventId);
                        return (
                            <div className="flex items-center gap-1">
                                <Button
                                    size="icon-sm"
                                    variant="ghost"
                                    data-drag-handle
                                    className="text-fg-tertiary hover:text-fg-primary cursor-grab active:cursor-grabbing"
                                    aria-label={`${title} 배너 순서 바꾸기 — 끌어 옮기거나 위·아래 방향키를 누르세요`}
                                    disabled={disabled}
                                    onKeyDown={(event) => {
                                        if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown')
                                            return;
                                        // 방향키는 표 안에서 자리를 옮기는 뜻으로 쓴다 — 화면이 같이 스크롤되지 않게 막는다
                                        event.preventDefault();
                                        onMove(
                                            row.original,
                                            event.key === 'ArrowUp' ? 'up' : 'down',
                                        );
                                    }}
                                >
                                    <GripVertical aria-hidden />
                                </Button>
                                <span className="text-body-bold text-fg-primary w-6 text-center tabular-nums">
                                    {row.index + 1}
                                </span>
                            </div>
                        );
                    },
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
                    cell: ({ row, getValue }) => (
                        <div className="flex min-w-0 flex-col">
                            <span className="text-body-sm-bold text-fg-primary">
                                {eventTitleOf(getValue())}
                            </span>
                            {/* 이미지 키는 사람이 읽는 값이 아니라 이름 아래 작은 글로만 */}
                            <span
                                title={row.original.imageKey}
                                className="text-caption text-fg-tertiary block max-w-56 truncate"
                            >
                                {row.original.imageKey}
                            </span>
                        </div>
                    ),
                }),
                helper.accessor('updatedAt', {
                    header: '수정일',
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
                // 수정·삭제는 오른쪽 끝에 같은 크기 테두리 버튼으로 나란히 — 삭제만 빨간 글씨
                helper.display({
                    id: 'detail',
                    header: () => <span className="block text-right">관리</span>,
                    cell: ({ row }) => {
                        const title = eventTitleOf(row.original.eventId);
                        return (
                            <div className="flex justify-end gap-2">
                                <Button
                                    size="sm"
                                    variant="secondary"
                                    aria-label={`${title} 배너 수정`}
                                    onClick={() => onEdit(row.original)}
                                >
                                    수정
                                </Button>
                                <Button
                                    size="sm"
                                    variant="secondary"
                                    className="text-semantic-error-strong hover:text-semantic-error-strong"
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

    const table = useTable({ features, columns, data: order });

    /*
     * 잡은 순간의 행 자리(위·아래 끝)를 적어 둔다. 끄는 동안 행들이 움직여도 이 칸 자리를 기준으로
     * 몇 번째 칸 위에 있는지 고르고, 잡은 행은 포인터를 그대로 따라 그린다 — 칸에 뚝뚝 붙지 않는다
     */
    const [drag, setDrag] = useState<{
        slots: { top: number; bottom: number }[];
        /** 행 안에서 잡은 높이 — 행 위쪽 끝이 포인터에서 이만큼 떨어져 따라온다 */
        grabOffset: number;
        pointerY: number;
    } | null>(null);

    const grab = (event: React.PointerEvent<HTMLTableRowElement>, bannerId: string) => {
        const body = bodyRef.current;
        // 손잡이는 버튼이지만 끌기의 출발점이다 — 다른 버튼·링크 위에서 시작한 누름만 그 칸의 것으로 둔다
        const onHandle =
            event.target instanceof Element && event.target.closest('[data-drag-handle]') !== null;
        if (disabled || !body || event.button !== 0) return;
        if (!onHandle && startsOnOwnControl(event.target)) return;
        // 이 행이 뒤이은 move·up을 끝까지 받게 잡아 둔다 — 표 밖으로 나가도 놓치지 않는다
        event.currentTarget.setPointerCapture(event.pointerId);
        event.preventDefault();
        const slots = [...body.rows].map((row) => row.getBoundingClientRect());
        const rowTop = event.currentTarget.getBoundingClientRect().top;
        setHeldId(bannerId);
        setDrag({ slots, grabOffset: event.clientY - rowTop, pointerY: event.clientY });
    };

    const track = (event: React.PointerEvent<HTMLTableRowElement>) => {
        if (!heldId || !drag) return;
        setDrag({ ...drag, pointerY: event.clientY });
        // 행 가운데가 들어간 칸으로 옮긴다 — 포인터 끝이 아니라 행 몸통 기준이라 자연스럽다
        const rowCenter =
            event.clientY - drag.grabOffset + (drag.slots[0]!.bottom - drag.slots[0]!.top) / 2;
        const to = rowIndexAt(drag.slots, rowCenter);
        if (to === null) return;
        setOrder((prev) =>
            moveItem(
                prev,
                prev.findIndex((banner) => banner.id === heldId),
                to,
            ),
        );
    };

    const release = () => {
        if (!heldId) return;
        setHeldId(null);
        setDrag(null);
        if (!sameOrder(order, banners)) onReorder(order.map((banner) => banner.id));
    };

    /** 끌다 말았을 때 — 저장된 순서로 되돌린다 */
    const cancel = () => {
        if (!heldId) return;
        setHeldId(null);
        setDrag(null);
        setOrder(banners);
    };

    // 잡은 행이 지금 놓일 칸의 위쪽 끝에서 포인터까지 — 이만큼 옮겨 그려 손을 따라오게 한다
    const heldShift = (index: number) => {
        if (!drag) return 0;
        const slot = drag.slots[index];
        return slot ? drag.pointerY - drag.grabOffset - slot.top : 0;
    };

    return (
        <div className="bg-surface-page border-border-default overflow-hidden border-y">
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
                <tbody ref={bodyRef} className="[&_tr:last-child]:border-0">
                    {table.getRowModel().rows.map((row) => {
                        const held = heldId === row.original.id;
                        return (
                            <motion.tr
                                key={row.original.id}
                                data-slot="table-row"
                                // 다른 행은 비켜날 때 미끄러지듯 움직이고, 잡은 행은 포인터를 바로 따른다
                                layout={held ? false : 'position'}
                                transition={{ type: 'spring', stiffness: 600, damping: 45 }}
                                aria-label={`${eventTitleOf(row.original.eventId)} 배너 — 끌어서 순서를 바꿀 수 있습니다`}
                                style={{
                                    /*
                                     * pan-y로 두어 손가락 세로 스크롤은 살린다 — none으로 막으면
                                     * 표가 있는 화면을 터치로 내릴 수 없다.
                                     */
                                    touchAction: 'pan-y',
                                    cursor: disabled ? undefined : heldId ? 'grabbing' : 'grab',
                                    y: held ? heldShift(row.index) : undefined,
                                }}
                                onPointerDown={(event) => grab(event, row.original.id)}
                                onPointerMove={track}
                                onPointerUp={release}
                                onPointerCancel={cancel}
                                className={cn(
                                    'border-border-default border-b transition-colors',
                                    // 표 행 hover는 sunken까지만 (DESIGN-SYSTEM '관리자 hover 규약')
                                    !heldId && 'hover:bg-surface-sunken',
                                    'focus-within:bg-surface-sunken',
                                    heldId && 'select-none',
                                    // 들고 있는 행 — 흰 바탕에 그림자로 표 위에 떠오른다. 마젠타 대신 무채색으로 '집었다'만 보인다
                                    held &&
                                        'bg-surface-page ring-border-strong relative z-10 shadow-lg ring-1',
                                    heldId && !held && 'bg-surface-canvas',
                                )}
                            >
                                {row.getAllCells().map((cell) => (
                                    <TableCell key={cell.id} className="px-4 py-3 align-middle">
                                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                    </TableCell>
                                ))}
                            </motion.tr>
                        );
                    })}
                </tbody>
            </Table>
        </div>
    );
}
