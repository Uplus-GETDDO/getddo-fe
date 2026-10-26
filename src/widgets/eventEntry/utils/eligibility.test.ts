import { describe, expect, it } from 'vitest';

import type { EntryEligibility } from '@entities/entry';

import { readEligibility } from './eligibility';

const eligibility = (reasons: EntryEligibility['reasons']): EntryEligibility => ({
    eventId: 'evt-1',
    canEnter: reasons.length === 0,
    reasons,
    usedTicketCount: 0,
    remainingTicketLimit: null,
    availableTicketBalance: 0,
    serverTime: '2026-10-26T00:00:00.000Z',
});

describe('readEligibility', () => {
    /*
     * 세 사유를 forbidden 하나로 뭉쳐 두면 버튼이 전부 '응모할 수 없어요'가 되어,
     * 우수 등급 사용자가 VIP 전용 이벤트에서 막힌 이유를 알 수 없었다(GD-358).
     */
    it('등급이 모자라면 어느 등급부터인지 적는다', () => {
        const verdict = readEligibility(eligibility(['ENTRY_MEMBERSHIP_NOT_MET']), 'vip');

        expect(verdict.forbidden).toBe(true);
        expect(verdict.forbiddenLabel).toBe('VIP 등급부터 응모할 수 있어요');
    });

    it('관리자 계정과 미오픈은 등급과 다른 말을 쓴다', () => {
        expect(
            readEligibility(eligibility(['ADMIN_ENTRY_FORBIDDEN']), 'excellent').forbiddenLabel,
        ).toBe('관리자 계정은 응모할 수 없어요');
        expect(readEligibility(eligibility(['EVENT_NOT_OPEN']), 'excellent').forbiddenLabel).toBe(
            '지금은 응모할 수 없어요',
        );
    });

    // 등급은 올릴 수 있고 관리자 계정은 아니다 — 손쓸 수 있는 쪽을 먼저 보여 준다
    it('사유가 겹치면 등급 안내를 먼저 적는다', () => {
        const verdict = readEligibility(
            eligibility(['ADMIN_ENTRY_FORBIDDEN', 'ENTRY_MEMBERSHIP_NOT_MET']),
            'vvip',
        );

        expect(verdict.forbiddenLabel).toBe('VVIP 등급부터 응모할 수 있어요');
    });

    it('막힌 게 아니면 문구를 두지 않는다', () => {
        expect(readEligibility(eligibility(['INSUFFICIENT_TICKETS']), 'excellent')).toMatchObject({
            forbidden: false,
            forbiddenLabel: null,
            lacking: true,
        });
    });
});
