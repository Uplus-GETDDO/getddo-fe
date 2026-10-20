import type { AdminEvent } from '@entities/event';

import { ADMIN_STATUS_META } from '@entities/event';
import { Badge } from '@shared/ui/badge';
import { Button } from '@shared/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@shared/ui/table';
import { cn } from '@shared/utils/cn';
import { formatKst } from '@shared/utils/date';
import { formatNumber } from '@shared/utils/format';

const HEAD = 'text-caption text-fg-tertiary h-11 px-4 font-semibold';
const CELL = 'text-body-sm px-4 py-3 align-middle';

/**
 * 이벤트를 고르기 전 첫 화면 — 추첨 관리 대상 이벤트를 표로 보여 고른다 (멘토링: 카드형일 필요 없이 목록으로 충분).
 * 한 줄에 단계·유형·이름·마감·당첨 인원·등록일을 두어 여러 건을 한눈에 비교한다. 줄 어디를 눌러도 그 이벤트를 연다.
 * 손이 먼저 가야 하는 이벤트(재추첨 중·발표 대기·마감)가 앞에 오도록 부모가 정렬해 넘긴다
 */
export function DrawEventPicker({
    events,
    onSelect,
}: {
    events: AdminEvent[];
    onSelect: (eventId: string) => void;
}) {
    return (
        <section aria-labelledby="draw-picker-title" className="flex flex-col gap-3">
            <div className="flex flex-col gap-0.5">
                <h2 id="draw-picker-title" className="text-body-bold text-fg-primary">
                    관리할 이벤트
                </h2>
                <p className="text-caption text-fg-tertiary">
                    마감 이후 이벤트 {formatNumber(events.length)}개 · 발표가 필요한 이벤트가 먼저
                    보여요
                </p>
            </div>
            <div className="bg-surface-page border-border-default overflow-hidden rounded-2xl border">
                <Table>
                    <TableHeader>
                        <TableRow className="hover:bg-transparent">
                            <TableHead className={HEAD}>추첨 단계</TableHead>
                            <TableHead className={HEAD}>유형</TableHead>
                            <TableHead className={HEAD}>이벤트</TableHead>
                            <TableHead className={HEAD}>마감</TableHead>
                            <TableHead className={cn(HEAD, 'text-right')}>당첨 인원</TableHead>
                            <TableHead className={HEAD}>등록일</TableHead>
                            <TableHead className={cn(HEAD, 'text-center')}>관리</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {events.map((event) => {
                            const status = ADMIN_STATUS_META[event.status];
                            const winners = event.prizes.reduce((sum, p) => sum + p.winnerCount, 0);
                            return (
                                <TableRow
                                    key={event.id}
                                    onClick={() => onSelect(event.id)}
                                    className="hover:bg-surface-sunken focus-within:bg-surface-sunken cursor-pointer"
                                >
                                    <TableCell className={CELL}>
                                        <Badge size="sm" className={status.chipClass}>
                                            {status.label}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className={cn(CELL, 'text-fg-secondary')}>
                                        {/* 겟또타임 = 응모권 사용 이벤트 (toEvent의 isTimeRaffle 기본값과 같은 기준) */}
                                        {event.eventType === 'TICKET' ? '겟또타임' : '이벤트'}
                                    </TableCell>
                                    <TableCell
                                        className={cn(
                                            CELL,
                                            'text-fg-primary max-w-80 font-semibold',
                                        )}
                                    >
                                        <span className="line-clamp-1">{event.title}</span>
                                    </TableCell>
                                    <TableCell
                                        className={cn(CELL, 'text-fg-secondary tabular-nums')}
                                    >
                                        {formatKst(event.endsAt)}
                                    </TableCell>
                                    <TableCell
                                        className={cn(
                                            CELL,
                                            'text-fg-secondary text-right tabular-nums',
                                        )}
                                    >
                                        {formatNumber(winners)}명
                                    </TableCell>
                                    <TableCell
                                        className={cn(CELL, 'text-fg-secondary tabular-nums')}
                                    >
                                        {formatKst(event.createdAt)}
                                    </TableCell>
                                    <TableCell className={cn(CELL, 'text-center')}>
                                        <Button
                                            size="sm"
                                            variant="ghost"
                                            className="hover:bg-surface-pressed"
                                            aria-label={`${event.title} 추첨 관리`}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                onSelect(event.id);
                                            }}
                                        >
                                            관리
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            );
                        })}
                    </TableBody>
                </Table>
            </div>
        </section>
    );
}
