import { cn } from '@shared/utils/cn';
import { formatKst } from '@shared/utils/date';

import type { TicketHistory, TicketOperationType } from '../model/history';

import { TICKET_GRADE_LABEL } from '../model/grade';
import { TICKET_OPERATION_DELTA } from '../model/operation';

// 처리 유형별 표시 — 지급·사용·반환·만료·정정을 별도 이력으로 기록한다 (getddo-spec ticket.md)
const TYPE_META: Record<TicketOperationType, { label: string; chipClass: string }> = {
    GRANT: { label: '지급', chipClass: 'bg-semantic-success-soft text-semantic-success' },
    REFUND: { label: '반환', chipClass: 'bg-semantic-success-soft text-semantic-success' },
    USE: { label: '사용', chipClass: 'bg-surface-sunken text-fg-secondary' },
    EXPIRE: { label: '만료', chipClass: 'bg-surface-sunken text-fg-tertiary' },
    CORRECTION: { label: '정정', chipClass: 'bg-surface-sunken text-fg-secondary' },
};

export function TicketHistoryItem({ history }: { history: TicketHistory }) {
    const meta = TYPE_META[history.operationType];
    const delta = TICKET_OPERATION_DELTA[history.operationType];
    return (
        <li className="flex items-center justify-between gap-4 py-4">
            <div className="flex min-w-0 items-center gap-3">
                <span
                    className={cn(
                        'text-caption shrink-0 rounded-md px-2 py-0.5 font-medium',
                        meta.chipClass,
                    )}
                >
                    {meta.label}
                </span>
                <div className="flex min-w-0 flex-col gap-0.5">
                    <p className="text-body-sm text-fg-primary truncate">{history.reason}</p>
                    <p className="text-caption text-fg-tertiary">
                        {TICKET_GRADE_LABEL[history.grade]} · {formatKst(history.createdAt)}
                    </p>
                </div>
            </div>
            {delta !== null && (
                <span
                    className={cn(
                        'text-body-sm-bold shrink-0',
                        delta > 0 ? 'text-semantic-success' : 'text-fg-primary',
                    )}
                >
                    {delta > 0 ? '+' : ''}
                    {delta}장
                </span>
            )}
        </li>
    );
}
