import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

import { Clock, Minus, PencilLine, Plus, Undo2 } from 'lucide-react';

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@shared/ui/table';
import { cn } from '@shared/utils/cn';
import { formatKst } from '@shared/utils/date';

import type { AdminTicketHistory } from '../model/admin';

import { TICKET_OPERATION_LABEL, TICKET_STATUS_LABEL } from '../model/admin';
import { TICKET_GRADE_LABEL } from '../model/grade';
import { TICKET_GRADE_IMAGE } from '../model/gradeImage';
import { TICKET_OPERATION_DELTA } from '../model/operation';

// 관리자 응모권 전체 이력 표 — 조회 전용이라 행에 변경 버튼이 없다 (스펙: 수동 지급·회수 경로 없음)

const TIME = 'text-fg-secondary text-body-sm whitespace-nowrap';

/** right — 숫자 열의 머리글. 자릿수가 맞도록 오른쪽으로 붙인다 */
function Frame({
    headers,
    right = [],
    label,
    children,
}: {
    headers: string[];
    right?: string[];
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
            className="bg-surface-page border-border-default focus-visible:ring-border-focus overflow-x-auto rounded-2xl border focus-visible:ring-2 focus-visible:outline-none [&>[data-slot=table-container]]:overflow-visible"
        >
            <Table>
                <TableHeader>
                    <TableRow className="hover:bg-transparent">
                        {headers.map((header) => (
                            <TableHead
                                key={header}
                                className={cn(
                                    'text-fg-tertiary h-11 px-4 text-xs font-semibold whitespace-nowrap',
                                    right.includes(header) && 'text-right',
                                )}
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

const Cell = ({ children, right = false }: { children: ReactNode; right?: boolean }) => (
    <TableCell className={cn('px-4 py-3 align-middle', right && 'text-right')}>
        {children}
    </TableCell>
);

function UserCell({ name, id }: { name: string; id: string }) {
    return (
        <div className="flex flex-col">
            <span className="text-body-sm-bold text-fg-primary">{name}</span>
            <span className="text-caption text-fg-tertiary">{id}</span>
        </div>
    );
}

// 처리 아이콘 — 색 칩 대신 통장 내역처럼 무엇이 일어났는지는 아이콘·글자로, 몇 장이 움직였는지는 맨 끝 숫자로 읽는다
const OPERATION_ICON: Record<AdminTicketHistory['operationType'], LucideIcon> = {
    GRANT: Plus,
    REFUND: Undo2,
    USE: Minus,
    EXPIRE: Clock,
    CORRECTION: PencilLine,
};

/** AO05 — 전체 이력. 조회 전용이라 줄에 올려도 눌리는 듯한 색을 입히지 않는다 */
export function AdminTicketHistoryTable({ rows }: { rows: AdminTicketHistory[] }) {
    return (
        <Frame
            headers={['처리 시각', '처리', '사용자', '등급', '이벤트·미션', '처리 후 상태', '변동']}
            right={['변동']}
            label="응모권 이력 표 가로 스크롤"
        >
            {rows.map((row) => {
                const delta = TICKET_OPERATION_DELTA[row.operationType];
                const Icon = OPERATION_ICON[row.operationType];
                return (
                    <TableRow key={row.id} className="hover:bg-transparent">
                        <Cell>
                            <span className={TIME}>{formatKst(row.createdAt)}</span>
                        </Cell>
                        <Cell>
                            <span className="text-body-sm-bold text-fg-primary flex items-center gap-2 whitespace-nowrap">
                                <span
                                    aria-hidden
                                    className="bg-surface-sunken text-fg-secondary flex size-6 shrink-0 items-center justify-center rounded-full"
                                >
                                    <Icon className="size-3.5" />
                                </span>
                                {TICKET_OPERATION_LABEL[row.operationType]}
                            </span>
                        </Cell>
                        <Cell>
                            <UserCell name={row.userName} id={row.userId} />
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
                                <span className="text-body-sm text-fg-primary">
                                    {TICKET_GRADE_LABEL[row.grade]}
                                </span>
                            </span>
                        </Cell>
                        <Cell>
                            <span className="text-body-sm text-fg-primary">
                                {row.eventTitle ?? row.missionTitle ?? '-'}
                            </span>
                        </Cell>
                        <Cell>
                            <span className="text-body-sm text-fg-secondary whitespace-nowrap">
                                {TICKET_STATUS_LABEL[row.status]}
                            </span>
                        </Cell>
                        {/* 늘면 초록 +1, 줄면 회색 −1, 정정은 장수가 그대로라 비운다 */}
                        <Cell right>
                            <span
                                className={cn(
                                    'text-body-sm-bold tabular-nums',
                                    delta === null
                                        ? 'text-fg-tertiary'
                                        : delta > 0
                                          ? 'text-status-approved-text'
                                          : 'text-fg-secondary',
                                )}
                            >
                                {delta === null
                                    ? '—'
                                    : delta > 0
                                      ? `+${delta}`
                                      : `−${Math.abs(delta)}`}
                            </span>
                        </Cell>
                    </TableRow>
                );
            })}
        </Frame>
    );
}
