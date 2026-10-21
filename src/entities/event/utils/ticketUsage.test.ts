import { describe, expect, it } from 'vitest';

import type { Event } from '../model/types';

import { describeTicketUsage } from './ticketUsage';

const event = (overrides: Partial<Event>): Event => ({
    id: 'evt',
    title: '래플',
    description: '',
    bannerImageUrl: null,
    startsAt: '2026-10-01T00:00:00Z',
    endsAt: '2026-10-19T00:00:00Z',
    status: 'open',
    eventType: 'TICKET',
    weightingEnabled: true,
    membershipRule: 'excellent',
    myEntered: false,
    requiredTickets: 1,
    ...overrides,
});

describe('describeTicketUsage', () => {
    it('응모권 미사용은 한 번만 참여한다', () => {
        expect(describeTicketUsage(event({ eventType: 'NO_TICKET', requiredTickets: 0 }))).toBe(
            '응모권 없이 한 번 응모',
        );
    });

    it('가중치 미적용은 브론즈 1장 한 번이다', () => {
        expect(describeTicketUsage(event({ weightingEnabled: false, maxTicketsPerUser: 1 }))).toBe(
            '브론즈 1장으로 한 번 응모',
        );
    });

    /*
     * 가중치 래플은 등급을 골라 여러 번 낼 수 있다. requiredTickets(1)를 그대로 적어
     * '1회 1장'으로 보이던 것이 이 함수를 만든 이유다.
     */
    it('가중치 적용은 누적 상한까지 나눠서 낸다', () => {
        expect(describeTicketUsage(event({ maxTicketsPerUser: 5 }))).toBe(
            '등급을 골라 최대 5장까지 나눠서 응모',
        );
    });

    it('상한이 없으면 장수를 제한하지 않는다', () => {
        expect(describeTicketUsage(event({ maxTicketsPerUser: null }))).toBe(
            '등급을 골라 장수 제한 없이 나눠서 응모',
        );
    });

    it('상한이 1장이면 나눠 낼 자리가 없다', () => {
        expect(describeTicketUsage(event({ maxTicketsPerUser: 1 }))).toBe('등급을 골라 1장만 응모');
    });

    // 목록(E01)만으로 만든 이벤트는 상한 실값이 없다 — 장수를 단정하지 않는다
    it('상한을 모르면 장수를 적지 않는다', () => {
        expect(describeTicketUsage(event({ maxTicketsPerUser: undefined }))).toBe(
            '등급을 골라 응모',
        );
    });
});
