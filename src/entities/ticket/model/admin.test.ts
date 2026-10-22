import { describe, expect, it } from 'vitest';

import { adminTicketHistorySchema } from './admin';

const NOW = '2026-10-12T00:00:00Z';

describe('관리자 응모권 스키마', () => {
    it('AO05는 eventTitle·missionTitle null을 허용한다', () => {
        const base = {
            id: 'h1',
            ticketId: 't1',
            operationType: 'GRANT',
            grade: 'GOLD',
            status: 'AVAILABLE',
            expiresAt: NOW,
            reason: '출석',
            createdAt: NOW,
            userId: 'u1',
            userName: '김도윤',
            eventTitle: null,
            missionTitle: null,
        };
        expect(adminTicketHistorySchema.safeParse(base).success).toBe(true);
    });
});
