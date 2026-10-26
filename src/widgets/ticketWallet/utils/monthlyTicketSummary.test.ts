import type { TicketHistory, TicketOperationType } from '@entities/ticket';

import { summarizeMonthlyTickets } from './monthlyTicketSummary';

const item = (
    id: string,
    operationType: TicketOperationType,
    createdAt: string,
): TicketHistory => ({
    id,
    ticketId: `ticket-${id}`,
    operationType,
    grade: 'BRONZE',
    status: 'AVAILABLE',
    expiresAt: '2026-11-30T15:00:00Z',
    reason: '테스트',
    createdAt,
});

describe('summarizeMonthlyTickets', () => {
    it('이번 달(KST) 적립과 사용을 나눠 장수를 센다', () => {
        const history = [
            item('a', 'GRANT', '2026-09-17T01:00:00Z'),
            item('b', 'USE', '2026-09-16T09:30:00Z'),
            item('c', 'USE', '2026-09-16T09:30:00Z'),
            item('d', 'USE', '2026-09-16T09:30:00Z'),
            item('e', 'GRANT', '2026-09-20T00:00:00Z'),
            item('f', 'REFUND', '2026-09-20T01:00:00Z'),
        ];
        expect(summarizeMonthlyTickets(history, new Date('2026-09-27T00:00:00Z'))).toEqual({
            earned: 3,
            used: 3,
        });
    });

    it('KST로 다음 달이 된 이력은 이번 달에서 제외한다', () => {
        // 2026-08-31T16:00Z = 2026-09-01 01:00 KST
        const history = [
            item('a', 'GRANT', '2026-08-31T16:00:00Z'),
            item('b', 'GRANT', '2026-08-31T14:00:00Z'),
        ];
        expect(summarizeMonthlyTickets(history, new Date('2026-09-10T00:00:00Z'))).toEqual({
            earned: 1,
            used: 0,
        });
    });
});
