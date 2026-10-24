import type { AdminEvent } from '@entities/event';

import { ADMIN_STATUS_META } from '@entities/event';
import { Badge } from '@shared/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@shared/ui/table';
import { cn } from '@shared/utils/cn';
import { formatKstFullDot } from '@shared/utils/date';
import { formatNumber } from '@shared/utils/format';

const HEAD = 'text-fg-tertiary h-11 px-4 text-xs font-semibold whitespace-nowrap';
const CELL = 'text-body-sm px-4 py-3 align-middle';

/**
 * 추첨할 이벤트 목록 — 줄 어디를 눌러도 오른쪽에 그 이벤트의 추첨 관리가 열린다.
 * 손이 먼저 가야 하는 이벤트(재추첨 중·발표 대기·마감)가 앞에 오도록 부모가 정렬해 넘긴다.
 * 오른쪽이 열려 칸이 좁으면(compact) 단계·이름·마감만 남긴다
 */
export function DrawEventPicker({
    events,
    onSelect,
    selectedId,
    compact = false,
}: {
    events: AdminEvent[];
    onSelect: (eventId: string) => void;
    selectedId?: string;
    compact?: boolean;
}) {
    return (
        <div className="bg-surface-page border-border-default overflow-hidden rounded-2xl border">
            <Table>
                <TableHeader>
                    <TableRow className="hover:bg-transparent">
                        <TableHead className={HEAD}>추첨 단계</TableHead>
                        <TableHead className={HEAD}>이벤트</TableHead>
                        <TableHead className={HEAD}>마감</TableHead>
                        {!compact && (
                            <>
                                <TableHead className={cn(HEAD, 'text-right')}>당첨 인원</TableHead>
                                <TableHead className={HEAD}>등록일</TableHead>
                            </>
                        )}
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {events.map((event) => {
                        const status = ADMIN_STATUS_META[event.status];
                        const winners = event.prizes.reduce((sum, p) => sum + p.winnerCount, 0);
                        const selected = event.id === selectedId;
                        return (
                            <TableRow
                                key={event.id}
                                onClick={() => onSelect(event.id)}
                                aria-selected={selectedId === undefined ? undefined : selected}
                                className={cn(
                                    'hover:bg-surface-sunken focus-within:bg-surface-sunken cursor-pointer',
                                    selected &&
                                        'bg-brand-soft hover:bg-brand-soft focus-within:bg-brand-soft',
                                )}
                            >
                                <TableCell className={CELL}>
                                    <Badge size="sm" className={status.chipClass}>
                                        {status.label}
                                    </Badge>
                                </TableCell>
                                {/* 이름을 진하게, 종류는 이름 아래 작은 글로 — 겟또타임 = 응모권 사용 이벤트 */}
                                <TableCell className={cn(CELL, 'max-w-80')}>
                                    <button
                                        type="button"
                                        aria-label={`${event.title} 추첨 관리`}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onSelect(event.id);
                                        }}
                                        className="text-fg-primary focus-visible:ring-border-focus line-clamp-1 block cursor-pointer rounded-sm text-left font-semibold hover:underline focus-visible:ring-2 focus-visible:outline-none"
                                    >
                                        {event.title}
                                    </button>
                                    <span className="text-caption text-fg-tertiary">
                                        {event.eventType === 'TICKET' ? '겟또타임' : '이벤트'}
                                    </span>
                                </TableCell>
                                <TableCell
                                    className={cn(
                                        CELL,
                                        'text-fg-secondary whitespace-nowrap tabular-nums',
                                    )}
                                >
                                    {formatKstFullDot(event.endsAt, true)}
                                </TableCell>
                                {!compact && (
                                    <>
                                        <TableCell
                                            className={cn(
                                                CELL,
                                                'text-fg-primary text-right tabular-nums',
                                            )}
                                        >
                                            {formatNumber(winners)}명
                                        </TableCell>
                                        <TableCell
                                            className={cn(
                                                CELL,
                                                'text-fg-secondary whitespace-nowrap tabular-nums',
                                            )}
                                        >
                                            {formatKstFullDot(event.createdAt)}
                                        </TableCell>
                                    </>
                                )}
                            </TableRow>
                        );
                    })}
                </TableBody>
            </Table>
        </div>
    );
}
