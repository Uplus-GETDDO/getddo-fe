import type { ReactNode } from 'react';

import { badgeVariants } from '@shared/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@shared/ui/table';
import { cn } from '@shared/utils/cn';
import { formatKst } from '@shared/utils/date';

import type { AdminTicketHistory } from '../model/admin';

import { TICKET_OPERATION_LABEL, TICKET_STATUS_LABEL } from '../model/admin';
import { TICKET_GRADE_LABEL } from '../model/grade';

// 관리자 응모권 전체 이력 표 — 조회 전용이라 행에 변경 버튼이 없다 (스펙: 수동 지급·회수 경로 없음)

// 상태·분류 칩 — 사용자 화면과 같은 공용 배지 모양(둥근 알약, 높이 26·글자 12)에 색만 칩마다 입힌다
const CHIP = badgeVariants({ variant: null });
const TIME = 'text-fg-secondary text-body-sm whitespace-nowrap';

/** centered — 칩만 담는 열의 머리글. 칩 너비가 제각각이라 가운데로 맞춘다 */
function Frame({
    headers,
    centered = [],
    children,
}: {
    headers: string[];
    centered?: string[];
    children: ReactNode;
}) {
    return (
        <div className="bg-surface-page border-border-default overflow-hidden rounded-2xl border">
            <Table>
                <TableHeader>
                    <TableRow className="hover:bg-transparent">
                        {headers.map((header) => (
                            <TableHead
                                key={header}
                                className={cn(
                                    'text-caption text-fg-tertiary h-11 px-4 font-semibold',
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
            <span className="text-body-sm text-fg-primary">{name}</span>
            <span className="text-caption text-fg-secondary">{id}</span>
        </div>
    );
}

const Gray = ({ children }: { children: ReactNode }) => (
    <span className={`${CHIP} bg-surface-sunken text-fg-secondary`}>{children}</span>
);

/** AO05 — 전체 이력 */
export function AdminTicketHistoryTable({ rows }: { rows: AdminTicketHistory[] }) {
    return (
        <Frame
            centered={['처리', '등급']}
            headers={['처리 시각', '사용자', '처리', '등급', '처리 후 상태', '이벤트·미션']}
        >
            {rows.map((row) => (
                <TableRow key={row.id} className="hover:bg-surface-sunken">
                    <Cell>
                        <span className={TIME}>{formatKst(row.createdAt)}</span>
                    </Cell>
                    <Cell>
                        <UserCell name={row.userName} id={row.userId} />
                    </Cell>
                    <Cell center>
                        <Gray>{TICKET_OPERATION_LABEL[row.operationType]}</Gray>
                    </Cell>
                    <Cell center>
                        <Gray>{TICKET_GRADE_LABEL[row.grade]}</Gray>
                    </Cell>
                    <Cell>
                        <span className="text-body-sm text-fg-primary">
                            {TICKET_STATUS_LABEL[row.status]}
                        </span>
                    </Cell>
                    <Cell>
                        <span className="text-body-sm text-fg-primary">
                            {row.eventTitle ?? row.missionTitle ?? '-'}
                        </span>
                    </Cell>
                </TableRow>
            ))}
        </Frame>
    );
}
