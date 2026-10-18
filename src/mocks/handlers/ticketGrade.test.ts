import { afterEach, describe, expect, it, vi } from 'vitest';

import { TICKET_GRADE_ODDS, TICKET_GRADE_WEIGHT, ticketGradeSchema } from '@entities/ticket';

import {
    drawMockTicketGrade,
    getMockAvailableTicketCountByGrade,
    recordMockTicketGrant,
    recordMockTicketUse,
} from './ticket';

afterEach(() => vi.restoreAllMocks());

describe('네 등급 응모권 계약', () => {
    it.each([
        [0, 'BRONZE'],
        [0.799799, 'BRONZE'],
        [0.7998, 'SILVER'],
        [0.979799, 'SILVER'],
        [0.9798, 'GOLD'],
        [0.999799, 'GOLD'],
        [0.9998, 'PLATINUM'],
        [0.999999, 'PLATINUM'],
    ])('난수 %s의 등급은 %s다', (roll, grade) => {
        vi.spyOn(Math, 'random').mockReturnValue(roll);
        expect(drawMockTicketGrade()).toBe(grade);
    });

    it('확률 합계는 100이고 플래티넘 가중치는 10이다', () => {
        expect(ticketGradeSchema.options).toContain('PLATINUM');
        expect(Object.values(TICKET_GRADE_ODDS).reduce((sum, odds) => sum + odds, 0)).toBeCloseTo(
            100,
        );
        expect(TICKET_GRADE_ODDS.PLATINUM).toBe(0.02);
        expect(TICKET_GRADE_WEIGHT.PLATINUM).toBe(10);
    });

    it('플래티넘 지급·차감도 보유 장수에 반영한다', () => {
        const user = `platinum-${crypto.randomUUID()}`;
        recordMockTicketGrant(user, 1, '플래티넘 테스트', { grade: 'PLATINUM' });
        expect(getMockAvailableTicketCountByGrade(user).PLATINUM).toBe(1);
        recordMockTicketUse(user, { PLATINUM: 1 }, 'evt-002');
        expect(getMockAvailableTicketCountByGrade(user).PLATINUM).toBe(0);
    });
});
