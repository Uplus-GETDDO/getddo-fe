import { describe, expect, it } from 'vitest';

import {
    adminTicketHistorySchema,
    ticketConsistencySchema,
    ticketGrantSchema,
    ticketInconsistencySchema,
    ticketRefundSchema,
} from './admin';

const NOW = '2026-10-12T00:00:00Z';

describe('관리자 응모권 스키마', () => {
    it('AO03 지급 이력은 missionId 없이도 파싱한다', () => {
        const parsed = ticketGrantSchema.parse({
            historyId: 'h1',
            ticketId: 't1',
            userId: 'u1',
            userName: '김도윤',
            grade: 'BRONZE',
            sourceType: 'ATTENDANCE',
            sourceId: 'a1',
            grantedAt: NOW,
            expiresAt: NOW,
        });
        expect(parsed.missionId).toBeUndefined();
    });

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

    it('AO04 불일치 항목은 상태 enum이 닫혀 있다', () => {
        const ok = {
            userId: 'u1',
            userName: '김도윤',
            availableCount: 1,
            isConsistent: false,
            inconsistencies: [
                {
                    ticketId: 't1',
                    ticketVersion: 2,
                    latestHistoryVersion: 3,
                    ticketStatus: 'AVAILABLE',
                    latestHistoryStatus: 'SPENT',
                },
            ],
            checkedAt: NOW,
        };
        expect(ticketConsistencySchema.safeParse(ok).success).toBe(true);
        const [first] = ok.inconsistencies;
        if (first) first.ticketStatus = 'UNKNOWN';
        expect(ticketConsistencySchema.safeParse(ok).success).toBe(false);
    });

    // 이력이 한 건도 없는 응모권은 마지막 이력 상태가 null이다 (spec AO04)
    it('AO04 불일치 항목의 마지막 이력 상태는 null을 허용한다', () => {
        const parsed = ticketConsistencySchema.safeParse({
            userId: 'u1',
            // ADR-028 — 이름은 표시용 부가 정보라 생략·null을 모두 허용한다 (BE 미배포)
            availableCount: 1,
            isConsistent: false,
            inconsistencies: [
                {
                    ticketId: 't1',
                    ticketVersion: 2,
                    latestHistoryVersion: 0,
                    ticketStatus: 'AVAILABLE',
                    latestHistoryStatus: null,
                },
            ],
            checkedAt: NOW,
        });
        expect(parsed.success).toBe(true);
    });

    it('AO09는 사용자 이름과 등급을 포함한다', () => {
        const row = {
            ticketId: 't1',
            ticketVersion: 1,
            latestHistoryVersion: 2,
            ticketStatus: 'AVAILABLE',
            latestHistoryStatus: 'SPENT',
            userId: 'u1',
            userName: '박서연',
            grade: 'SILVER',
            checkedAt: NOW,
        };
        expect(ticketInconsistencySchema.safeParse(row).success).toBe(true);
        expect(ticketInconsistencySchema.safeParse({ ...row, grade: undefined }).success).toBe(
            false,
        );
    });

    it('AO08 반환 사유는 EVENT_CANCELED만 허용한다', () => {
        const refund = {
            id: 'r1',
            spendHistoryId: 'h1',
            ticketId: 't1',
            grade: 'BRONZE',
            eventId: 'e1',
            eventTitle: '래플',
            userId: 'u1',
            userName: '김도윤',
            reasonType: 'EVENT_CANCELED',
            refundedAt: NOW,
            targetExpiresAt: NOW,
        };
        expect(ticketRefundSchema.safeParse(refund).success).toBe(true);
        // 반환 대상 이력에 만료 시각이 없으면 null이다 (spec AO08)
        expect(ticketRefundSchema.safeParse({ ...refund, targetExpiresAt: null }).success).toBe(
            true,
        );
        expect(
            ticketRefundSchema.safeParse({ ...refund, reasonType: 'PARTICIPANT_EXCLUDED' }).success,
        ).toBe(false);
    });
});
