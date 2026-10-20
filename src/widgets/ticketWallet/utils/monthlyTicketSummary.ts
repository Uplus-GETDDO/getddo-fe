import type { TicketHistory } from '@entities/ticket';

import { toKst } from '@shared/utils/date';

// 이력 한 건은 응모권 한 장의 처리다 — 적립은 지급·반환 건수, 사용은 차감·만료 건수로 센다
const EARNED: ReadonlySet<TicketHistory['operationType']> = new Set(['GRANT', 'REFUND']);
const USED: ReadonlySet<TicketHistory['operationType']> = new Set(['USE', 'EXPIRE']);

/** 불러온 이력 중 이번 달(KST 달력 기준)의 적립·사용 장수를 구한다 (표시용) */
export function summarizeMonthlyTickets(history: TicketHistory[], now: Date) {
    const current = toKst(now);
    const isThisMonth = (iso: string) => {
        const date = toKst(iso);
        return (
            date.getUTCFullYear() === current.getUTCFullYear() &&
            date.getUTCMonth() === current.getUTCMonth()
        );
    };

    return history
        .filter((item) => isThisMonth(item.createdAt))
        .reduce(
            (sum, item) =>
                EARNED.has(item.operationType)
                    ? { ...sum, earned: sum.earned + 1 }
                    : USED.has(item.operationType)
                      ? { ...sum, used: sum.used + 1 }
                      : sum,
            { earned: 0, used: 0 },
        );
}
