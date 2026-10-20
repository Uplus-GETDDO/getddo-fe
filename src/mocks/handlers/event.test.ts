import { describe, expect, it } from 'vitest';

import type { AdminEventStatus } from '@entities/event';

import { apiClient } from '@shared/api/client';

import { ANNOUNCE_DELAY_MS } from './event';

interface EventResponse {
    id: string;
    title: string;
    status: AdminEventStatus;
    startsAt: string;
    endsAt: string;
    isTimeRaffle?: boolean;
}

// 목업 이벤트가 페이지 기본값(20)보다 많다 — 시연 플로우용 래플까지 모두 받도록 한 번에 넉넉히 요청한다
async function events() {
    const { data } = await apiClient.get<{ data: { items: EventResponse[] } }>(
        '/v1/events?size=100',
    );
    return data.data.items;
}

describe('이벤트 목업 핸들러', () => {
    it('목록의 myEntered는 접수 기록을 따르고 관리자·헤더 없음은 false다', async () => {
        for (const role of ['USER', 'ADMIN']) {
            const { data } = await apiClient.get<{
                data: { items: (EventResponse & { myEntered: boolean })[] };
            }>('/v1/events?size=100', {
                headers: { 'X-User-ID': 'my-entered-test', 'X-User-Role': role },
            });
            const items = data.data.items as (EventResponse & { myEntered: boolean })[];
            expect(items.find((event) => event.id === 'evt-001')?.myEntered).toBe(role === 'USER');
            expect(items.find((event) => event.id === 'evt-107')?.myEntered).toBe(false);
        }
        for (const event of await events()) expect(event).toHaveProperty('myEntered', false);
        const { data } = await apiClient.get<{ data: EventResponse }>('/v1/events/evt-001');
        expect(data.data).not.toHaveProperty('myEntered');
    });

    it('상태를 기간에서 다시 계산해 spec 원시 enum으로 돌려준다 — 적어 둔 status와 어긋나지 않는다', async () => {
        const now = Date.now();

        for (const event of await events()) {
            const starts = new Date(event.startsAt).getTime();
            const ends = new Date(event.endsAt).getTime();

            const expected: AdminEventStatus =
                now < starts
                    ? 'SCHEDULED'
                    : now < ends
                      ? 'OPEN'
                      : now < ends + ANNOUNCE_DELAY_MS
                        ? 'CLOSED'
                        : 'PUBLISHED';

            expect(event.status, `${event.id} ${event.title}`).toBe(expected);
        }
    });

    // 계약 가드 — 발표 예정 시각은 ADR-022로 모든 이벤트 응답에서 제거됐다 (05-api/event.md)
    it('이벤트 응답에 발표 예정 시각(publicationScheduledAt)을 싣지 않는다', async () => {
        for (const event of await events()) {
            expect(event, event.id).not.toHaveProperty('publicationScheduledAt');
        }
    });

    // spec 구분 — 목록(E01)은 EventSummary, 상세(E02)는 description·prizes를 더 가진 EventDetail이다
    it('목록 항목은 EventSummary 모양이고 상세에는 description·prizes가 있다', async () => {
        const items = await events();
        for (const event of items) {
            expect(event, event.id).not.toHaveProperty('description');
            expect(event, event.id).not.toHaveProperty('prizes');
            expect(event, event.id).not.toHaveProperty('maxTicketsPerUser');
            expect(event, event.id).toHaveProperty('imageUrl');
            expect(event, event.id).toHaveProperty('serverTime');
        }

        const { data } = await apiClient.get<{ data: EventResponse }>('/v1/events/evt-001');
        const detail = data.data as EventResponse & {
            description: string;
            prizes: { rank: number; winnerCount: number }[];
        };
        expect(detail.description).not.toBe('');
        expect(detail.prizes.length).toBeGreaterThan(0);
        expect(detail.prizes[0]).toHaveProperty('winnerCount');
    });

    /*
     * 시연 데이터는 세션이 시작한 시각을 기준으로 잡혀 있다.
     * "오늘 몇 시"로 고정하면 늦은 시각에 열었을 때 해당 상태가 통째로 비므로,
     * 네 상태를 맡는 이벤트가 각각 제 역할을 하는지 지목해서 확인한다.
     */
    it('시연 플로우를 밟을 수 있도록 각 상태의 타임래플이 하나씩 있다', async () => {
        const byId = new Map((await events()).map((event) => [event.id, event]));

        expect(byId.get('evt-112')?.status, '응모할 수 있는 래플').toBe('OPEN');
        expect(byId.get('evt-106')?.status, '발표를 기다리는 래플').toBe('CLOSED');
        expect(byId.get('evt-105')?.status, '아직 열리지 않은 래플').toBe('SCHEDULED');
        // 어제 끝난 래플이라 시각과 무관하게 항상 발표 완료다
        expect(byId.get('evt-107')?.status, '발표가 끝난 래플').toBe('PUBLISHED');
    });
});
