import { getErrorCodeMessage } from '@shared/api/errorMessage';
import { cn } from '@shared/utils/cn';
import { formatKst } from '@shared/utils/date';
import { formatNumber } from '@shared/utils/format';

import type { Entry, EntryStatus } from '../model/types';

// 접수 상태만 표시한다 — 당첨 여부는 발표 화면에서 다룬다 (docs/CONTEXT.md: 발표 전 당첨 정보 비노출)
const STATUS_META: Record<EntryStatus, { label: string; chipClass: string }> = {
    ACCEPTED: { label: '접수', chipClass: 'bg-semantic-success-soft text-semantic-success' },
    REJECTED: { label: '거절', chipClass: 'bg-surface-sunken text-fg-tertiary' },
};

export function MyEntryItem({ entry }: { entry: Entry }) {
    const meta = STATUS_META[entry.status];
    // 거절 사유는 오류 문구 매핑을 우선 쓰고, 매핑이 없는 코드는 서버가 준 사유를 보인다 (GD-145)
    const rejectionReason =
        entry.status === 'REJECTED'
            ? (getErrorCodeMessage(entry.rejectionCode) ?? entry.rejectionReason)
            : null;

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
                    <p className="text-body-sm text-fg-primary truncate">{entry.eventTitle}</p>
                    <p className="text-caption text-fg-tertiary">{formatKst(entry.requestedAt)}</p>
                    {rejectionReason && (
                        <p className="text-caption text-destructive">{rejectionReason}</p>
                    )}
                </div>
            </div>
            <span className="text-body-sm-bold text-fg-primary shrink-0">
                {entry.deductedTicketCount === 0
                    ? '응모권 미사용'
                    : `${formatNumber(entry.deductedTicketCount)}장 사용`}
            </span>
        </li>
    );
}
