import type { ReactNode } from 'react';

import { badgeVariants } from '@shared/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@shared/ui/table';
import { cn } from '@shared/utils/cn';
import { formatKst } from '@shared/utils/date';

import type { AdminTicketHistory } from '../model/admin';

import { TICKET_OPERATION_LABEL, TICKET_STATUS_LABEL } from '../model/admin';
import { TICKET_GRADE_LABEL } from '../model/grade';
import { TICKET_GRADE_IMAGE } from '../model/gradeImage';
import { TICKET_OPERATION_DELTA } from '../model/operation';

// 관리자 응모권 전체 이력 표 — 조회 전용이라 행에 변경 버튼이 없다 (스펙: 수동 지급·회수 경로 없음)

// 상태·분류 칩 — 사용자 화면과 같은 공용 배지 모양(둥근 알약, 높이 26·글자 12)에 색만 칩마다 입힌다
const CHIP = badgeVariants({ variant: null });
const TIME = 'text-fg-secondary text-body-sm whitespace-nowrap';

/** centered — 칩만 담는 열의 머리글. 칩 너비가 제각각이라 가운데로 맞춘다 */
function Frame({
    headers,
    centered = [],
    label,
    children,
}: {
    headers: string[];
    centered?: string[];
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
                                    centered.includes(header) && 'text-center',
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

const Cell = ({ children, center = false }: { children: ReactNode; center?: boolean }) => (
    <TableCell className={cn('px-4 py-3 align-middle', center && 'text-center')}>
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

// 처리 유형 칩 — 늘어나는 처리(지급·반환)는 초록, 줄어드는 사용은 파랑, 만료는 흐리게, 정정은 노랑
const OPERATION_CHIP: Record<AdminTicketHistory['operationType'], string> = {
    GRANT: 'bg-status-approved text-status-approved-text',
    REFUND: 'bg-status-approved text-status-approved-text',
    USE: 'bg-status-active text-status-active-text',
    EXPIRE: 'bg-surface-sunken text-fg-tertiary',
    CORRECTION: 'bg-status-pending text-status-pending-text',
};

/** AO05 — 전체 이력 */
export function AdminTicketHistoryTable({ rows }: { rows: AdminTicketHistory[] }) {
    return (
        <Frame
            headers={['처리', '등급', '사용자', '이벤트·미션', '처리 후 상태', '처리 시각']}
            label="응모권 이력 표 가로 스크롤"
        >
            {rows.map((row) => {
                const delta = TICKET_OPERATION_DELTA[row.operationType];
                return (
                    <TableRow key={row.id} className="hover:bg-surface-sunken">
                        {/* 무엇이 일어났는지(처리)와 몇 장이 움직였는지를 맨 앞에 */}
                        <Cell>
                            <span className="flex items-center gap-2 whitespace-nowrap">
                                <span className={cn(CHIP, OPERATION_CHIP[row.operationType])}>
                                    {TICKET_OPERATION_LABEL[row.operationType]}
                                </span>
                                {delta !== null && (
                                    <span
                                        className={
                                            delta > 0
                                                ? 'text-body-sm-bold text-status-approved-text tabular-nums'
                                                : 'text-body-sm-bold text-fg-secondary tabular-nums'
                                        }
                                    >
                                        {delta > 0 ? `+${delta}` : `−${Math.abs(delta)}`}
                                    </span>
                                )}
                            </span>
                        </Cell>
                        {/* 등급은 응모권 그림과 이름으로 — 등급 색 알약은 표를 얼룩지게 해 오히려 눈에 안 들어왔다 */}
                        <Cell>
                            <span className="flex items-center gap-2">
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
                            <UserCell name={row.userName} id={row.userId} />
                        </Cell>
                        <Cell>
                            <span className="text-body-sm text-fg-primary">
                                {row.eventTitle ?? row.missionTitle ?? '-'}
                            </span>
                        </Cell>
                        <Cell>
                            <span className="text-body-sm text-fg-secondary">
                                {TICKET_STATUS_LABEL[row.status]}
                            </span>
                        </Cell>
                        <Cell>
                            <span className={TIME}>{formatKst(row.createdAt)}</span>
                        </Cell>
                    </TableRow>
                );
            })}
        </Frame>
    );
}
