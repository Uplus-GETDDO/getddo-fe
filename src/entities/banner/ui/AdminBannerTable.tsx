import { createColumnHelper, flexRender, tableFeatures, useTable } from '@tanstack/react-table';
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
                helper.display({
                    id: 'order',
                    header: () => <span className="block w-10 text-center">순서</span>,
                    /*
                     * 저장된 값이 아니라 목록 안의 자리를 센다 — 끄는 동안에도 숫자가 바로 따라온다.
                     * 관리자 목록은 숨김 배너까지 1~N으로 오므로(05-api/banner.md) 평소 값과 같다.
                     */
                    cell: ({ row }) => (
                        // 자릿수가 늘어도 가운데가 흔들리지 않게 너비를 고정하고 숫자 폭을 맞춘다
                        <span className="text-body-bold text-fg-primary block w-10 text-center tabular-nums">
                            {row.index + 1}
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
                    /*
                     * 끌어 옮긴다는 표시 한 개만 둔다. 실제로 잡는 자리는 행 전체이고,
                     * 이 자리는 마우스를 못 쓰는 경우의 유일한 길이라 방향키를 받는다.
                     */
                    cell: ({ row }) => {
                        const title = eventTitleOf(row.original.eventId);
                        return (
                            <Button
                                size="icon"
                                variant="ghost"
                                className="hover:bg-surface-pressed hover:text-fg-primary text-fg-tertiary cursor-grab active:cursor-grabbing"
                                aria-label={`${title} 배너 순서 바꾸기 — 끌어 옮기거나 위·아래 방향키를 누르세요`}
                                disabled={disabled}
                                onKeyDown={(event) => {
                                    if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown')
                                        return;
                                    // 방향키는 표 안에서 자리를 옮기는 뜻으로 쓴다 — 화면이 같이 스크롤되지 않게 막는다
                                    event.preventDefault();
                                    onMove(row.original, event.key === 'ArrowUp' ? 'up' : 'down');
                                }}
                            >
                                <GripVertical aria-hidden />
                            </Button>
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

    const table = useTable({ features, columns, data: order });

    const grab = (event: React.PointerEvent<HTMLTableRowElement>, bannerId: string) => {
        if (disabled || event.button !== 0 || startsOnOwnControl(event.target)) return;
        // 이 행이 뒤이은 move·up을 끝까지 받게 잡아 둔다 — 표 밖으로 나가도 놓치지 않는다
        event.currentTarget.setPointerCapture(event.pointerId);
        event.preventDefault();
        setHeldId(bannerId);
    };

    const track = (event: React.PointerEvent<HTMLTableRowElement>) => {
        const body = bodyRef.current;
        if (!heldId || !body) return;

        const to = rowIndexAt(
            [...body.rows].map((row) => row.getBoundingClientRect()),
            event.clientY,
        );
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
        if (!sameOrder(order, banners)) onReorder(order.map((banner) => banner.id));
    };

    /** 끌다 말았을 때 — 저장된 순서로 되돌린다 */
    const cancel = () => {
        if (!heldId) return;
        setHeldId(null);
        setOrder(banners);
    };

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
                <tbody ref={bodyRef} className="[&_tr:last-child]:border-0">
                    {table.getRowModel().rows.map((row) => {
                        const held = heldId === row.original.id;
                        return (
                            <TableRow
                                key={row.original.id}
                                aria-label={`${eventTitleOf(row.original.eventId)} 배너 — 끌어서 순서를 바꿀 수 있습니다`}
                                style={{
                                    /*
                                     * pan-y로 두어 손가락 세로 스크롤은 살린다 — none으로 막으면
                                     * 표가 있는 화면을 터치로 내릴 수 없다.
                                     */
                                    touchAction: 'pan-y',
                                    cursor: disabled ? undefined : heldId ? 'grabbing' : 'grab',
                                }}
                                onPointerDown={(event) => grab(event, row.original.id)}
                                onPointerMove={track}
                                onPointerUp={release}
                                onPointerCancel={cancel}
                                className={cn(
                                    'transition-colors',
                                    // 표 행 hover는 sunken까지만 (DESIGN-SYSTEM '관리자 hover 규약')
                                    !heldId && 'hover:bg-surface-sunken',
                                    'focus-within:bg-surface-sunken',
                                    heldId && 'select-none',
                                    /*
                                     * 들고 있는 행 — '선택된 행'의 brand/soft 바탕을 그대로 쓴다.
                                     * 그림자는 한 단계만 줘서 표 위에 살짝 떠 보이게 한다.
                                     * hover도 같은 색으로 묶는다 — 끄는 내내 포인터가 이 행 위에 있어
                                     * TableRow의 기본 hover 색이 이겨 버린다.
                                     */
                                    held &&
                                        'bg-brand-soft hover:bg-brand-soft relative z-10 shadow-md',
                                )}
                            >
                                {row.getAllCells().map((cell) => (
                                    <TableCell key={cell.id} className="px-4 py-3 align-middle">
                                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                    </TableCell>
                                ))}
                            </TableRow>
                        );
                    })}
                </tbody>
            </Table>
        </div>
    );
}
