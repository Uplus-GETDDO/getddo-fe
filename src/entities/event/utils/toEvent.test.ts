import { describe, expect, it } from 'vitest';

import type { EventDetailResponse, EventSummaryResponse } from '../model/contract';

import { toEvent } from './toEvent';

const SUMMARY: EventSummaryResponse = {
    id: 'evt-1',
    title: '시험 이벤트',
    imageUrl: 'https://example.com/banner.png',
    eventType: 'TICKET',
    weightingEnabled: true,
    membershipRule: 'vip',
    startsAt: '2026-10-20T00:00:00Z',
    endsAt: '2026-10-21T00:00:00Z',
    status: 'OPEN',
    serverTime: '2026-10-20T12:00:00Z',
};

const DETAIL: EventDetailResponse = {
    ...SUMMARY,
    description: '상세 설명',
    maxTicketsPerUser: 5,
    prizes: [
        {
            id: 'p2',
            rank: 2,
            name: '보조 경품',
            description: null,
            imageUrl: null,
            winnerCount: 7,
        },
        {
            id: 'p1',
            rank: 1,
            name: '1등 경품',
            description: null,
            imageUrl: null,
            winnerCount: 3,
        },
    ],
};

describe('toEvent', () => {
    it('목록의 myEntered를 반영하고 누락·상세는 false로 매핑한다', () => {
        expect(toEvent({ ...SUMMARY, myEntered: true }).myEntered).toBe(true);
        expect(toEvent(SUMMARY).myEntered).toBe(false);
        expect(toEvent({ ...DETAIL, myEntered: true }).myEntered).toBe(false);
    });

    it('spec 상태 enum을 화면 상태로 변환한다', () => {
        const cases: [EventSummaryResponse['status'], string][] = [
            ['SCHEDULED', 'upcoming'],
            ['OPEN', 'open'],
            ['CLOSED', 'closed'],
            ['DRAW_CONFIRMED', 'closed'],
            ['REDRAWING', 'closed'],
            ['CANCELED', 'canceled'],
            ['PUBLISHED', 'drawn'],
            ['NO_ENTRANTS', 'ended'],
            ['NO_ELIGIBLE_ENTRANTS', 'ended'],
        ];
        for (const [status, expected] of cases) {
            expect(toEvent({ ...SUMMARY, status }).status).toBe(expected);
        }
    });

    it('imageUrl을 bannerImageUrl로 옮긴다', () => {
        expect(toEvent(SUMMARY).bannerImageUrl).toBe('https://example.com/banner.png');
        expect(toEvent({ ...SUMMARY, imageUrl: null }).bannerImageUrl).toBeNull();
    });

    it('목록이 준 당첨 인원 합계를 그대로 쓴다 — 목록에는 prizes가 없다', () => {
        expect(toEvent({ ...SUMMARY, winnerCount: 120 }).winnerCount).toBe(120);
    });

    it('합계가 오지 않으면 비워 둔다 — 0으로 꾸미지 않는다', () => {
        expect(toEvent(SUMMARY).winnerCount).toBeUndefined();
    });

    it('상세는 prizes 합계를 쓴다 — 목록 합계와 어긋나도 경품이 근거다', () => {
        expect(toEvent({ ...DETAIL, winnerCount: 999 }).winnerCount).toBe(10);
    });

    it('prizes를 rank 오름차순으로 요약해 prizeName·winnerCount를 파생한다', () => {
        const event = toEvent(DETAIL);
        expect(event.prizeName).toBe('1등 경품 외 1종');
        expect(event.winnerCount).toBe(10);
    });

    it('경품이 하나면 이름만 쓰고, 없으면 파생 필드를 비운다', () => {
        const single = toEvent({
            ...DETAIL,
            prizes: [{ ...DETAIL.prizes[0]!, rank: 1 }],
        });
        expect(single.prizeName).toBe('보조 경품');
        expect(single.winnerCount).toBe(7);
    });

    it('eventType·weightingEnabled로 requiredTickets를 파생한다', () => {
        expect(toEvent(SUMMARY).requiredTickets).toBe(1);
        expect(
            toEvent({ ...SUMMARY, eventType: 'NO_TICKET', weightingEnabled: false })
                .requiredTickets,
        ).toBe(0);
    });

    it('목록 응답에는 경품·상세 설명·응모 상한이 없어 파생 필드가 비거나 근사된다', () => {
        const event = toEvent(SUMMARY);
        expect(event.prizeName).toBeUndefined();
        expect(event.winnerCount).toBeUndefined();
        expect(event.description).toBe('');
        // 가중치 이벤트는 상한이 정수·null(월말 소진용) 모두 가능해 근사하지 않는다
        expect(event.maxTicketsPerUser).toBeUndefined();
    });

    it('상한이 spec상 확정된 목록 조합만 채운다 — 미사용은 null, 가중치 미적용은 1', () => {
        expect(
            toEvent({ ...SUMMARY, eventType: 'NO_TICKET', weightingEnabled: false })
                .maxTicketsPerUser,
        ).toBeNull();
        expect(toEvent({ ...SUMMARY, weightingEnabled: false }).maxTicketsPerUser).toBe(1);
    });

    it('상세 응답은 실제 maxTicketsPerUser를 쓴다', () => {
        expect(toEvent(DETAIL).maxTicketsPerUser).toBe(5);
        const unlimited: EventDetailResponse = { ...DETAIL, maxTicketsPerUser: null };
        expect(toEvent(unlimited).maxTicketsPerUser).toBeNull();
    });

    it('isTimeRaffle이 없으면 응모권 사용 이벤트를 타임래플로 근사한다', () => {
        // 실서버 응답에는 분류 필드가 없다 — CONTEXT.md "타임래플 = 응모권 차감 이벤트"
        expect(toEvent(SUMMARY).isTimeRaffle).toBe(true);
        expect(
            toEvent({ ...SUMMARY, eventType: 'NO_TICKET', weightingEnabled: false }).isTimeRaffle,
        ).toBe(false);
        // 명시된 값이 오면 그대로 쓴다
        expect(toEvent({ ...SUMMARY, isTimeRaffle: false }).isTimeRaffle).toBe(false);
    });

    it('시연 전용 필드와 응모 수치는 있는 그대로 통과한다', () => {
        const raw: EventSummaryResponse = {
            ...SUMMARY,
            isTimeRaffle: true,
            myEntryCount: 2,
            myTicketCount: 4,
        };
        const event = toEvent(raw);
        expect(event.isTimeRaffle).toBe(true);
        expect(event.myEntryCount).toBe(2);
        expect(event.myTicketCount).toBe(4);
    });
});
