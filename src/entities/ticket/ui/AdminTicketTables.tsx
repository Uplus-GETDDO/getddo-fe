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
            label="응모권 이력 표 가로 스크롤"
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
