import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

import { Clock, Minus, PenLine, Plus, Undo2 } from 'lucide-react';

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@shared/ui/table';
import { cn } from '@shared/utils/cn';
import { formatKst } from '@shared/utils/date';

import type { AdminTicketHistory } from '../model/admin';
import type { TicketOperationType } from '../model/history';

import { TICKET_OPERATION_LABEL, TICKET_STATUS_LABEL } from '../model/admin';
import { TICKET_GRADE_LABEL } from '../model/grade';
import { TICKET_GRADE_IMAGE } from '../model/gradeImage';
import { TICKET_OPERATION_DELTA } from '../model/operation';

// 관리자 응모권 전체 이력 표 — 조회 전용이라 행에 변경 버튼이 없다 (스펙: 수동 지급·회수 경로 없음)

const TIME = 'text-fg-secondary text-body-sm whitespace-nowrap';

/**
 * columns — 칸 이름과 표 전체에서 차지할 폭. 폭을 정해 두고(table-fixed) 고르게 펼친다 —
 * 마지막 칸이 남는 폭을 다 가져가면 짧은 값들이 왼쪽에 쏠려 붙어 보였다
 */
function Frame({
    columns,
    label,
    children,
}: {
    columns: { header: string; width: string }[];
    /** 가로 스크롤 영역의 이름 — 좁은 화면에서 표가 카드 안으로 스크롤할 때 읽힌다 */
    label: string;
    children: ReactNode;
}) {
    return (
        // 좁은 화면에서 표가 카드 밖으로 넘치면 카드 안쪽 가로 스크롤로 접근한다 — 스크롤 영역은
        // 키보드 진입이 가능해야 하므로 region+tabIndex를 둔다 (GD-317 어뷰징 표와 같은 패턴)
        <div
            role="region"
            aria-label={label}
            tabIndex={0}
            className="bg-surface-page border-border-default focus-visible:ring-border-focus overflow-x-auto border-y focus-visible:ring-2 focus-visible:outline-none [&>[data-slot=table-container]]:overflow-visible"
        >
            <Table className="min-w-[56rem] table-fixed">
                <TableHeader>
                    <TableRow className="hover:bg-transparent">
                        {columns.map(({ header, width }) => (
                            <TableHead
                                key={header}
                                style={{ width }}
                                className="text-fg-tertiary h-11 px-4 text-xs font-semibold whitespace-nowrap"
                            >
                                {header}
                            </TableHead>
                        ))}
                    </TableRow>
                </TableHeader>
                <TableBody>{children}</TableBody>
            </Table>
        </div>
    );
}

const Cell = ({ children }: { children: ReactNode }) => (
    <TableCell className="truncate px-4 py-3 align-middle">{children}</TableCell>
);

function UserCell({ name, id }: { name: string; id: string }) {
    return (
        <div className="flex min-w-0 flex-col">
            <span className="text-body-sm-bold text-fg-primary truncate">{name}</span>
            <span className="text-caption text-fg-tertiary truncate">{id}</span>
        </div>
    );
}

/** 처리마다 모양으로 구분하는 아이콘 — 색은 들어옴·나감 두 가지로만 쓴다 */
const OPERATION_ICON: Record<TicketOperationType, LucideIcon> = {
    GRANT: Plus,
    REFUND: Undo2,
    USE: Minus,
    EXPIRE: Clock,
    CORRECTION: PenLine,
};

/**
 * 처리 칸 — 아이콘 동그라미 · 처리 이름 · 장수 변동.
 * 장수가 느는 처리(지급·반환)는 응모권 노랑 바탕, 줄거나 그대로인 처리(사용·만료·정정)는 회색 바탕으로
 * 들어옴·나감만 색으로 나눈다 — 처리마다 색을 달리하거나 +만 초록으로 두면 표가 얼룩지고 오히려 흐려 보였다.
 * 정정은 장수가 그대로라 변동을 적지 않는다
 */
function OperationCell({ type }: { type: TicketOperationType }) {
    const delta = TICKET_OPERATION_DELTA[type];
    const Icon = OPERATION_ICON[type];
    const gain = delta !== null && delta > 0;
    return (
        <span className="flex items-center gap-2 whitespace-nowrap">
            <span
                aria-hidden
                className={cn(
                    'flex size-6 shrink-0 items-center justify-center rounded-full',
                    gain
                        ? 'bg-ticket-accent text-ticket-on'
                        : 'bg-surface-sunken text-fg-secondary',
                )}
            >
                <Icon className="size-3.5" strokeWidth={2.5} />
            </span>
            <span className="text-fg-primary text-sm font-semibold">
                {TICKET_OPERATION_LABEL[type]}
            </span>
            {delta !== null && (
                <span className="text-fg-secondary text-sm tabular-nums">
                    {delta > 0 ? `+${delta}` : `−${Math.abs(delta)}`}
                </span>
            )}
        </span>
    );
}

/**
 * AO05 — 전체 이력. 조회 전용이라 줄에 올려도 눌리는 듯한 색을 입히지 않는다.
 * 무엇이 일어났는지(처리)와 몇 장 움직였는지(변동)를 한 칸에 붙이고, 길이가 제각각인 이벤트·미션 이름을 맨 끝에 둔다
 */
const COLUMNS = [
    { header: '처리 시각', width: '17%' },
    { header: '처리', width: '13%' },
    { header: '등급', width: '12%' },
    { header: '사용자', width: '17%' },
    { header: '처리 후 상태', width: '12%' },
    { header: '이벤트·미션', width: '29%' },
];

export function AdminTicketHistoryTable({ rows }: { rows: AdminTicketHistory[] }) {
    return (
        <Frame columns={COLUMNS} label="응모권 이력 표 가로 스크롤">
            {rows.map((row) => (
                <TableRow key={row.id} className="hover:bg-transparent">
                    <Cell>
                        <span className={TIME}>{formatKst(row.createdAt)}</span>
                    </Cell>
                    <Cell>
                        <OperationCell type={row.operationType} />
                    </Cell>
                    {/* 등급은 응모권 그림과 이름으로 — 등급 색 알약은 표를 얼룩지게 해 오히려 눈에 안 들어왔다 */}
                    <Cell>
                        <span className="flex items-center gap-2 whitespace-nowrap">
                            <img
                                src={TICKET_GRADE_IMAGE[row.grade]}
                                alt=""
                                aria-hidden
                                className="h-5 w-auto shrink-0"
                            />
                            <span className="text-fg-primary text-sm">
                                {TICKET_GRADE_LABEL[row.grade]}
                            </span>
                        </span>
                    </Cell>
                    <Cell>
                        <UserCell name={row.userName} id={row.userId} />
                    </Cell>
                    <Cell>
                        <span className="text-fg-secondary text-sm whitespace-nowrap">
                            {TICKET_STATUS_LABEL[row.status]}
                        </span>
                    </Cell>
                    <Cell>
                        <span className="text-fg-primary text-sm">
                            {row.eventTitle ?? row.missionTitle ?? '-'}
                        </span>
                    </Cell>
                </TableRow>
            ))}
        </Frame>
    );
}
