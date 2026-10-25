import type { ReactNode } from 'react';

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

/** wide — 남는 폭을 모두 가져갈 열(긴 이름). 나머지 칸은 내용 폭만큼만 차지해 왼쪽에 모인다 */
function Frame({
    headers,
    wide = [],
    label,
    children,
}: {
    headers: string[];
    wide?: string[];
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
            <Table>
                <TableHeader>
                    <TableRow className="hover:bg-transparent">
                        {headers.map((header) => (
                            <TableHead
                                key={header}
                                className={cn(
                                    'text-fg-tertiary h-11 px-4 text-xs font-semibold whitespace-nowrap',
                                    wide.includes(header) && 'w-full',
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

const Cell = ({ children, wide = false }: { children: ReactNode; wide?: boolean }) => (
    <TableCell className={cn('px-4 py-3 align-middle', wide && 'w-full')}>{children}</TableCell>
);

function UserCell({ name, id }: { name: string; id: string }) {
    return (
        <div className="flex flex-col">
            <span className="text-body-sm-bold text-fg-primary">{name}</span>
            <span className="text-caption text-fg-tertiary">{id}</span>
        </div>
    );
}

/** 처리 뒤 장수 변동 — 늘면 +1, 줄면 −1, 정정은 장수가 그대로라 표시하지 않는다 */
function DeltaText({ delta }: { delta: number | null }) {
    if (delta === null) return null;
    return (
        <span
            className={cn(
                'text-sm font-semibold tabular-nums',
                delta > 0 ? 'text-status-approved-text' : 'text-fg-tertiary',
            )}
        >
            {delta > 0 ? `+${delta}` : `−${Math.abs(delta)}`}
        </span>
    );
}

/**
 * AO05 — 전체 이력. 조회 전용이라 줄에 올려도 눌리는 듯한 색을 입히지 않는다.
 * 무엇이 일어났는지(처리)와 몇 장 움직였는지(변동)를 한 칸에 붙이고, 길이가 제각각인 이벤트·미션 이름을 맨 끝에 두어
 * 짧은 값들이 왼쪽에 모이게 한다 — 칸이 표 전체 폭으로 흩어지면 좌우 끝을 오가며 읽어야 했다
 */
export function AdminTicketHistoryTable({ rows }: { rows: AdminTicketHistory[] }) {
    return (
        <Frame
            headers={['처리 시각', '처리', '등급', '사용자', '처리 후 상태', '이벤트·미션']}
            wide={['이벤트·미션']}
            label="응모권 이력 표 가로 스크롤"
        >
            {rows.map((row) => (
                <TableRow key={row.id} className="hover:bg-transparent">
                    <Cell>
                        <span className={TIME}>{formatKst(row.createdAt)}</span>
                    </Cell>
                    <Cell>
                        <span className="flex items-baseline gap-2 whitespace-nowrap">
                            <span className="text-fg-primary text-sm font-semibold">
                                {TICKET_OPERATION_LABEL[row.operationType]}
                            </span>
                            <DeltaText delta={TICKET_OPERATION_DELTA[row.operationType]} />
                        </span>
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
                    <Cell wide>
                        <span className="text-fg-primary text-sm">
                            {row.eventTitle ?? row.missionTitle ?? '-'}
                        </span>
                    </Cell>
                </TableRow>
            ))}
        </Frame>
    );
}
