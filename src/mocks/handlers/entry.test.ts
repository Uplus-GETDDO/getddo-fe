import { describe, expect, it } from 'vitest';

import { apiClient } from '@shared/api/client';
import { IDEMPOTENCY_HEADER } from '@shared/utils/idempotencyKey';

import { recordMockTicketGrant } from './ticket';

// 목업은 모듈 수준 상태를 들고 있어 테스트끼리 영향을 준다.
// 한 이벤트·사용자 조합은 한 번만 접수되므로 테스트마다 새 사용자를 쓰고,
// 한도 소진이 필요한 테스트는 관리자 목업으로 조건이 맞는 이벤트를 직접 만든다.
/** 가중치 미적용(브론즈 1장·1회) — 시연 기준 시각에 붙은 창이라 언제 돌려도 진행 중이다 */
const BRONZE_ONLY_EVENT_ID = 'evt-003';
/** 두 번째 가중치 미적용 이벤트 — evt-001은 내역 표시용 시드가 있어 여기서는 독립 시드를 쓴다 */
const BRONZE_ONLY_EVENT_ID_2 = 'evt-204';
/** 일반 가중치(누적 5장) 진행 중 이벤트 */
const WEIGHTED_EVENT_ID = 'evt-002';
/** 응모권을 쓰지 않는 진행 중 이벤트 */
const FREE_EVENT_ID = 'evt-011';
const FREE_EVENT_ID_2 = 'evt-013';
/** 통계 테스트 전용 미사용 이벤트 — 다른 테스트가 응모하지 않아 응모자 수 증가를 순수하게 본다 */
const FREE_EVENT_ID_FOR_STATS = 'evt-202';
/** 진행 예정 이벤트 — 아직 응모할 수 없다 */
const UPCOMING_EVENT_ID = 'evt-005';
/** vip 이상만 응모할 수 있는 진행 예정 이벤트 */
const VIP_EVENT_ID = 'evt-010';
/** vip 이상만 응모할 수 있는 진행 중 이벤트 — 우수 등급은 ENTRY-003, vip 이상은 정상 접수된다 */
const VIP_OPEN_EVENT_ID = 'evt-014';

type Grade = 'BRONZE' | 'SILVER' | 'GOLD' | 'PLATINUM';
type GradeMap = Record<Grade, number>;

interface EntryReceipt {
    id: string;
    eventId: string;
    eventTitle: string;
    requestedTicketCount: number;
    requestedTicketsByGrade: GradeMap;
    deductedTicketCount: number;
    deductedTicketsByGrade: GradeMap;
    status: string;
    acceptedAt: string | null;
    rejectionCode: string | null;
    rejectionReason: string | null;
}

interface Envelope<T> {
    success: boolean;
    data: T;
}

const uniqueUser = (label: string) => `test-${label}-${Date.now()}`;
const uniqueKey = (label: string) => `test-${label}-${Date.now()}`;

async function ticketCounts(userId?: string) {
    const { data } = await apiClient.get<{
        data: { availableCount: number; countByGrade: GradeMap };
    }>('/v1/tickets/me', { headers: userId ? { 'X-User-ID': userId } : {} });
    return data.data;
}

function enter(key: string, tickets: unknown, eventId: string, userId?: string) {
    return apiClient.post(
        `/v1/events/${eventId}/entries`,
        { tickets },
        {
            headers: {
                [IDEMPOTENCY_HEADER]: key,
                ...(userId ? { 'X-User-ID': userId } : {}),
            },
            validateStatus: () => true,
        },
    );
}

async function eligibility(eventId: string, userId?: string) {
    const { data } = await apiClient.get<
        Envelope<{
            eventId: string;
            canEnter: boolean;
            reasons: string[];
            usedTicketCount: number;
            remainingTicketLimit: number | null;
            availableTicketBalance: number;
            serverTime: string;
        }>
    >(`/v1/events/${eventId}/eligibility`, {
        headers: userId ? { 'X-User-ID': userId } : {},
    });
    return data.data;
}

async function myEntries(userId?: string) {
    const { data } = await apiClient.get<Envelope<{ items: EntryReceipt[] }>>(
        '/v1/users/me/entries',
        {
            headers: userId ? { 'X-User-ID': userId } : {},
        },
    );
    return data.data.items;
}

// E05 — 이벤트별 내 응모 내역
async function myEventEntries(eventId: string, userId?: string) {
    const { data } = await apiClient.get<Envelope<{ items: EntryReceipt[] }>>(
        `/v1/events/${eventId}/entries/me`,
        { headers: userId ? { 'X-User-ID': userId } : {} },
    );
    return data.data.items;
}

/** 관리자 목업으로 진행 중 이벤트를 만들어 조건을 직접 지정한다 — 시드에 없는 조합(월말 소진용 등)용 */
async function createOpenEvent(over: Record<string, unknown> = {}) {
    const res = await apiClient.post(
        '/v1/admin/events',
        {
            title: '응모 테스트 이벤트',
            description: '테스트용 이벤트입니다',
            imageKey: null,
            eventType: 'TICKET',
            weightingEnabled: true,
            maxTicketsPerUser: 5,
            membershipRule: 'excellent',
            // 고정 날짜는 지나면 이벤트가 closed가 돼 실행 시점에 따라 실패한다
            startsAt: new Date(Date.now() - 60 * 1000).toISOString(),
            endsAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
            prizes: [
                { rank: 1, name: '테스트 경품', winnerCount: 1, description: null, imageKey: null },
            ],
            ...over,
        },
        { validateStatus: () => true },
    );
    expect(res.status).toBe(201);
    return (res.data as Envelope<{ id: string }>).data.id;
}

describe('응모 목업 핸들러', () => {
    it('플래티넘은 가중치 이벤트에서 차감하고 브론즈 전용 이벤트에서는 거절한다', async () => {
        const user = uniqueUser('platinum');
        recordMockTicketGrant(user, 2, '플래티넘 테스트', { grade: 'PLATINUM' });
        const accepted = await enter(
            uniqueKey('platinum'),
            { PLATINUM: 1 },
            WEIGHTED_EVENT_ID,
            user,
        );
        expect(accepted.status).toBe(201);
        const receipt = (accepted.data as Envelope<EntryReceipt>).data;
        expect(receipt.deductedTicketCount).toBe(1);
        expect(receipt.deductedTicketsByGrade.PLATINUM).toBe(1);
        const rejected = await enter(
            uniqueKey('platinum-bronze'),
            { BRONZE: 1, PLATINUM: 1 },
            BRONZE_ONLY_EVENT_ID,
            user,
        );
        expect(rejected.status).toBe(409);
        expect(rejected.data).toHaveProperty('code', 'ENTRY-008');
    });

    it('같은 멱등키로 다시 내면 응모권을 또 차감하지 않는다', async () => {
        const key = uniqueKey('retry');
        const userId = uniqueUser('retry');
        const before = await ticketCounts(userId);

        const first = await enter(key, { BRONZE: 1 }, BRONZE_ONLY_EVENT_ID, userId);
        expect(first.status).toBe(201);
        expect((await ticketCounts(userId)).countByGrade.BRONZE).toBe(
            before.countByGrade.BRONZE - 1,
        );

        // 응답이 유실돼 사용자가 같은 응모를 재시도한 상황
        const retry = await enter(key, { BRONZE: 1 }, BRONZE_ONLY_EVENT_ID, userId);
        expect(retry.status).toBe(200);
        expect(retry.data).toEqual(first.data);
        expect((await ticketCounts(userId)).countByGrade.BRONZE).toBe(
            before.countByGrade.BRONZE - 1,
        );
    });

    it('같은 멱등키로 다른 장수 맵을 내면 ENTRY-009로 거절한다', async () => {
        const key = uniqueKey('conflict');
        const userId = uniqueUser('conflict');
        await enter(key, { BRONZE: 1 }, WEIGHTED_EVENT_ID, userId);

        const conflict = await enter(key, { BRONZE: 2 }, WEIGHTED_EVENT_ID, userId);
        expect(conflict.status).toBe(409);
        expect(conflict.data).toMatchObject({ success: false, code: 'ENTRY-009' });
    });

    it('저장된 멱등키의 재전송은 깨진 본문이어도 처음 결과를 돌려준다', async () => {
        const key = uniqueKey('replay-malformed');
        const userId = uniqueUser('replay-malformed');
        const first = await enter(key, { BRONZE: 1 }, BRONZE_ONLY_EVENT_ID_2, userId);
        expect(first.status).toBe(201);

        // 재전송 본문이 깨져 있어도 멱등키 재생이 페이로드 규칙보다 먼저다
        const retried = await apiClient.post(
            `/v1/events/${BRONZE_ONLY_EVENT_ID_2}/entries`,
            { tickets: '깨진-맵' },
            {
                headers: { [IDEMPOTENCY_HEADER]: key, 'X-User-ID': userId },
                validateStatus: () => true,
            },
        );
        expect(retried.status).toBe(200);
        expect(retried.data).toEqual(first.data);
    });

    it('tickets 맵이 형식에 맞지 않으면 ENTRY-001로 거절하고 잔액을 건드리지 않는다', async () => {
        const userId = uniqueUser('invalid');
        const before = await ticketCounts(userId);

        for (const tickets of [
            'abc',
            { BRONZE: '1' },
            { BRONZE: -1 },
            { BRONZE: 1, RUBY: 2 },
            { BRONZE: 1.5 },
        ]) {
            const response = await enter(uniqueKey('invalid'), tickets, WEIGHTED_EVENT_ID, userId);
            expect(response.status).toBe(400);
            expect(response.data).toMatchObject({ success: false, code: 'ENTRY-001' });
        }
        expect((await ticketCounts(userId)).countByGrade).toEqual(before.countByGrade);
    });

    it('멱등키가 없으면 400으로 거절한다', async () => {
        const response = await apiClient.post(
            `/v1/events/${WEIGHTED_EVENT_ID}/entries`,
            { tickets: { BRONZE: 1 } },
            { validateStatus: () => true },
        );

        expect(response.status).toBe(400);
    });

    it('접수한 응모가 영수증 등급별 장수와 함께 내 응모 내역에 쌓인다', async () => {
        const userId = uniqueUser('list');
        const key = uniqueKey('list');
        const before = await myEntries(userId);

        const response = await enter(key, { BRONZE: 1, SILVER: 1 }, WEIGHTED_EVENT_ID, userId);
        expect(response.status).toBe(201);

        const receipt = (response.data as Envelope<EntryReceipt>).data;
        // 영수증 ID는 멱등키다 — 재전송 판정의 기준이다
        expect(receipt.id).toBe(key);
        expect(receipt.requestedTicketCount).toBe(2);
        expect(receipt.deductedTicketCount).toBe(2);
        // 등급 맵은 0인 등급도 모두 포함한다 (spec EntryReceipt)
        expect(receipt.requestedTicketsByGrade).toEqual({
            BRONZE: 1,
            SILVER: 1,
            GOLD: 0,
            PLATINUM: 0,
        });
        expect(receipt.deductedTicketsByGrade).toEqual({
            BRONZE: 1,
            SILVER: 1,
            GOLD: 0,
            PLATINUM: 0,
        });

        const after = await myEntries(userId);
        expect(after.length).toBe(before.length + 1);
        const latest = after[0];
        if (!latest) throw new Error('응모 내역이 비어 있습니다');
        expect(latest.id).toBe(key);
        expect(latest.eventId).toBe(WEIGHTED_EVENT_ID);
        expect(latest.eventTitle).not.toBe('');
    });

    it('업무 거절도 키에 묶여, 같은 키 재시도는 처음 거절을 그대로 돌려준다', async () => {
        const key = uniqueKey('reject');
        const userId = uniqueUser('reject');

        // 골드는 1장뿐 — 보유를 넘는 등급별 요청은 확정된 업무 거절이다
        const rejected = await enter(key, { GOLD: 2 }, WEIGHTED_EVENT_ID, userId);
        expect(rejected.status).toBe(409);

        const retry = await enter(key, { GOLD: 2 }, WEIGHTED_EVENT_ID, userId);
        expect(retry.status).toBe(409);
        expect(retry.data).toEqual(rejected.data);
    });

    it('가중치 이벤트는 등급별 장수대로 차감한다', async () => {
        const userId = uniqueUser('deduct');
        const before = await ticketCounts(userId);

        const response = await enter(
            uniqueKey('deduct'),
            { SILVER: 1, GOLD: 1 },
            WEIGHTED_EVENT_ID,
            userId,
        );
        expect(response.status).toBe(201);

        const after = await ticketCounts(userId);
        expect(after.countByGrade.SILVER).toBe(before.countByGrade.SILVER - 1);
        expect(after.countByGrade.GOLD).toBe(before.countByGrade.GOLD - 1);
        expect(after.countByGrade.BRONZE).toBe(before.countByGrade.BRONZE);
    });

    it('등급별 보유가 모자라면 TICKET-006으로 거절한다', async () => {
        const userId = uniqueUser('insufficient');
        const before = await ticketCounts(userId);

        const response = await enter(
            uniqueKey('insufficient'),
            { GOLD: before.countByGrade.GOLD + 1 },
            WEIGHTED_EVENT_ID,
            userId,
        );
        expect(response.status).toBe(409);
        expect(response.data).toMatchObject({ success: false, code: 'TICKET-006' });
        expect((await ticketCounts(userId)).countByGrade).toEqual(before.countByGrade);
    });

    it('가중치 이벤트는 사용자당 누적 5장까지 받는다', async () => {
        const userId = uniqueUser('limit');
        const eventId = await createOpenEvent({ maxTicketsPerUser: 5 });

        const first = await enter(uniqueKey('limit1'), { BRONZE: 5 }, eventId, userId);
        expect(first.status).toBe(201);

        // 이미 5장을 썼으므로 1장만 더 내도 누적 상한에 걸린다
        const over = await enter(uniqueKey('limit2'), { BRONZE: 1 }, eventId, userId);
        expect(over.status).toBe(409);
        expect(over.data).toMatchObject({ success: false, code: 'ENTRY-007' });
    });

    it('월말 소진용(maxTicketsPerUser null)은 상한 없이 보유한 만큼 낼 수 있다', async () => {
        const userId = uniqueUser('unlimited');
        const eventId = await createOpenEvent({ maxTicketsPerUser: null });
        const before = await ticketCounts(userId);

        const response = await enter(
            uniqueKey('unlimited'),
            { BRONZE: 7, SILVER: 2, GOLD: 1, PLATINUM: 0 },
            eventId,
            userId,
        );
        expect(response.status).toBe(201);
        expect((await ticketCounts(userId)).availableCount).toBe(before.availableCount - 10);
    });

    it('가중치 미적용 이벤트는 브론즈 1장만 받고 다른 등급·장수는 ENTRY-008로 거절한다', async () => {
        const userA = uniqueUser('bronze-a');
        const userB = uniqueUser('bronze-b');

        for (const tickets of [
            { SILVER: 1 },
            { GOLD: 1 },
            { BRONZE: 2 },
            { BRONZE: 1, SILVER: 1 },
            {},
        ]) {
            const response = await enter(uniqueKey('bronze'), tickets, BRONZE_ONLY_EVENT_ID, userB);
            expect(response.status).toBe(409);
            expect(response.data).toMatchObject({ success: false, code: 'ENTRY-008' });
        }

        const ok = await enter(uniqueKey('bronze-ok'), { BRONZE: 1 }, BRONZE_ONLY_EVENT_ID, userA);
        expect(ok.status).toBe(201);
        const receipt = (ok.data as Envelope<EntryReceipt>).data;
        expect(receipt.requestedTicketsByGrade).toEqual({
            BRONZE: 1,
            SILVER: 0,
            GOLD: 0,
            PLATINUM: 0,
        });

        // 미적용 이벤트도 사용자당 한 번만 접수된다
        const again = await enter(
            uniqueKey('bronze-again'),
            { BRONZE: 1 },
            BRONZE_ONLY_EVENT_ID,
            userA,
        );
        expect(again.status).toBe(409);
        expect(again.data).toMatchObject({ success: false, code: 'ENTRY-006' });
    });

    it('내역 표시용 시드가 있어도 evt-001에 새로 응모되고 1회 제한은 실제 응모로만 판정한다', async () => {
        const userId = uniqueUser('seed-demo');
        const res = await enter(uniqueKey('seed-demo'), { BRONZE: 1 }, 'evt-001', userId);
        expect(res.status).toBe(201);

        const again = await enter(uniqueKey('seed-demo-2'), { BRONZE: 1 }, 'evt-001', userId);
        expect(again.status).toBe(409);
        expect(again.data).toMatchObject({ success: false, code: 'ENTRY-006' });
    });

    it('E07은 시드 응모를 참여로 세지 않고 실제 응모 후에만 ALREADY_ENTERED를 돌려준다', async () => {
        const userId = uniqueUser('seed-elig');
        const before = await eligibility('evt-001', userId);
        expect(before.canEnter).toBe(true);
        expect(before.usedTicketCount).toBe(0);
        expect(before.reasons).not.toContain('ALREADY_ENTERED');

        const entered = await enter(uniqueKey('seed-elig'), { BRONZE: 1 }, 'evt-001', userId);
        expect(entered.status).toBe(201);

        const after = await eligibility('evt-001', userId);
        expect(after.reasons).toContain('ALREADY_ENTERED');
        expect(after.usedTicketCount).toBe(1);
    });

    it('미적용 이벤트에서 브론즈가 없으면 TICKET-006이 아니라 BRONZE_REQUIRED로 거절한다', async () => {
        const userId = uniqueUser('no-bronze');
        // 브론즈를 전부 쓰고 미적용 이벤트에 응모한다 — 등급이 남아 있어도 브론즈 전용이라 거절된다
        const drainEvent = await createOpenEvent({ maxTicketsPerUser: null });
        const drained = await enter(uniqueKey('drain'), { BRONZE: 7 }, drainEvent, userId);
        expect(drained.status).toBe(201);

        const response = await enter(
            uniqueKey('bronze-required'),
            { BRONZE: 1 },
            BRONZE_ONLY_EVENT_ID_2,
            userId,
        );
        expect(response.status).toBe(409);
        expect(response.data).toMatchObject({ success: false, code: 'ENTRY-008' });
    });

    it('관리자는 응모할 수 없다', async () => {
        const response = await enter(
            uniqueKey('admin'),
            { BRONZE: 1 },
            BRONZE_ONLY_EVENT_ID_2,
            'vu-admin',
        );
        expect(response.status).toBe(403);
        expect(response.data).toMatchObject({ success: false, code: 'ENTRY-002' });
    });

    it('멤버십 등급이 미달이면 ENTRY-003으로 거절한다', async () => {
        const response = await enter(
            uniqueKey('membership'),
            { BRONZE: 1 },
            VIP_EVENT_ID,
            uniqueUser('membership'),
        );
        expect(response.status).toBe(403);
        expect(response.data).toMatchObject({ success: false, code: 'ENTRY-003' });
    });

    it('진행 중 VIP 이벤트는 vip 사용자가 응모하고 우수 등급은 ENTRY-003으로 거절된다', async () => {
        // vu-doyoon은 우수(excellent), vu-seoyeon은 vip 등급의 시드 가상 사용자다
        const denied = await enter(
            uniqueKey('vip-denied'),
            { BRONZE: 1 },
            VIP_OPEN_EVENT_ID,
            'vu-doyoon',
        );
        expect(denied.status).toBe(403);
        expect(denied.data).toMatchObject({ success: false, code: 'ENTRY-003' });

        const accepted = await enter(
            uniqueKey('vip-ok'),
            { BRONZE: 1 },
            VIP_OPEN_EVENT_ID,
            'vu-seoyeon',
        );
        expect(accepted.status).toBe(201);
    });

    it('헤더 멤버십이 사용자 멤버십과 다르면 409로 거절한다', async () => {
        const response = await apiClient.post(
            `/v1/events/${BRONZE_ONLY_EVENT_ID_2}/entries`,
            { tickets: { BRONZE: 1 } },
            {
                headers: {
                    [IDEMPOTENCY_HEADER]: uniqueKey('membership-header'),
                    'X-User-ID': 'vu-seoyeon',
                    'X-User-Membership': 'excellent',
                },
                validateStatus: () => true,
            },
        );
        expect(response.status).toBe(409);
        expect(response.data).toMatchObject({ success: false });
    });

    it('진행 중이 아닌 이벤트는 ENTRY-005로 거절한다', async () => {
        const response = await enter(
            uniqueKey('closed'),
            { BRONZE: 1 },
            UPCOMING_EVENT_ID,
            uniqueUser('closed'),
        );
        expect(response.status).toBe(409);
        expect(response.data).toMatchObject({ success: false, code: 'ENTRY-005' });
    });

    it('응모권 미사용 이벤트는 빈 tickets만 받고 사용자당 한 번만 접수된다', async () => {
        const userId = uniqueUser('free');

        // 미사용 이벤트에 장수를 내면 형식 거절
        const withTickets = await enter(
            uniqueKey('free-tickets'),
            { BRONZE: 1 },
            FREE_EVENT_ID,
            userId,
        );
        expect(withTickets.status).toBe(400);
        expect(withTickets.data).toMatchObject({ success: false, code: 'ENTRY-001' });

        const first = await enter(uniqueKey('free1'), {}, FREE_EVENT_ID, userId);
        expect(first.status).toBe(201);
        const receipt = (first.data as Envelope<EntryReceipt>).data;
        expect(receipt.requestedTicketsByGrade).toEqual({
            BRONZE: 0,
            SILVER: 0,
            GOLD: 0,
            PLATINUM: 0,
        });

        const second = await enter(uniqueKey('free2'), {}, FREE_EVENT_ID, userId);
        expect(second.status).toBe(409);
        expect(second.data).toMatchObject({ success: false, code: 'ENTRY-006' });
    });

    it('응모 내역은 사용자별로 분리된다', async () => {
        const userA = uniqueUser('iso-a');
        const userB = uniqueUser('iso-b');

        const entered = await enter(uniqueKey('iso'), {}, FREE_EVENT_ID_2, userA);
        expect(entered.status).toBe(201);

        const bEntries = await myEntries(userB);
        expect(bEntries.some((entry) => entry.eventId === FREE_EVENT_ID_2)).toBe(false);

        const aEntries = await myEntries(userA);
        expect(aEntries.some((entry) => entry.eventId === FREE_EVENT_ID_2)).toBe(true);
    });

    describe('거절 이력 (GD-145)', () => {
        it('업무 거절은 거절 영수증으로 E06 내역에 남는다', async () => {
            const userId = uniqueUser('rej-history');
            const key = uniqueKey('rej-history');

            // 골드는 1장뿐 — 보유를 넘는 등급별 요청은 확정된 업무 거절이다
            const rejected = await enter(key, { GOLD: 2 }, WEIGHTED_EVENT_ID, userId);
            expect(rejected.status).toBe(409);
            expect(rejected.data).toMatchObject({ success: false, code: 'TICKET-006' });

            const receipt = (await myEntries(userId)).find((entry) => entry.id === key);
            expect(receipt).toBeDefined();
            expect(receipt).toMatchObject({
                eventId: WEIGHTED_EVENT_ID,
                status: 'REJECTED',
                requestedTicketCount: 2,
                requestedTicketsByGrade: { BRONZE: 0, SILVER: 0, GOLD: 2, PLATINUM: 0 },
                // 거절은 응모권을 차감하지 않는다 (spec EntryReceipt)
                deductedTicketCount: 0,
                deductedTicketsByGrade: { BRONZE: 0, SILVER: 0, GOLD: 0, PLATINUM: 0 },
                acceptedAt: null,
                rejectionCode: 'TICKET-006',
            });
            expect(receipt?.rejectionReason).not.toBeNull();
        });

        it('E05 이벤트별 내역에도 같은 거절 건이 포함된다', async () => {
            const userId = uniqueUser('rej-e05');
            const key = uniqueKey('rej-e05');

            const rejected = await enter(key, { BRONZE: 2 }, BRONZE_ONLY_EVENT_ID, userId);
            expect(rejected.status).toBe(409);
            expect(rejected.data).toMatchObject({ success: false, code: 'ENTRY-008' });

            const receipt = (await myEventEntries(BRONZE_ONLY_EVENT_ID, userId)).find(
                (entry) => entry.id === key,
            );
            expect(receipt).toMatchObject({
                status: 'REJECTED',
                rejectionCode: 'ENTRY-008',
                deductedTicketCount: 0,
            });
        });

        it('형식 오류·없는 이벤트 거절은 응모 내역에 남지 않는다', async () => {
            const userId = uniqueUser('rej-format');
            const malformedKey = uniqueKey('rej-malformed');
            const notFoundKey = uniqueKey('rej-notfound');

            const malformed = await enter(malformedKey, 'abc', WEIGHTED_EVENT_ID, userId);
            expect(malformed.status).toBe(400);
            const notFound = await enter(notFoundKey, { BRONZE: 1 }, 'evt-none', userId);
            expect(notFound.status).toBe(404);

            const ids = (await myEntries(userId)).map((entry) => entry.id);
            expect(ids).not.toContain(malformedKey);
            expect(ids).not.toContain(notFoundKey);
        });

        it('거절 이력이 있어도 접수된 응모로 세지 않아 1회 제한·차감 합계에 섞이지 않는다', async () => {
            const userId = uniqueUser('rej-count');
            const before = await ticketCounts(userId);

            // 거절된 뒤 같은 이벤트에 새 키로 정상 응모하면 접수된다
            const rejected = await enter(
                uniqueKey('rej-count'),
                { GOLD: 2 },
                WEIGHTED_EVENT_ID,
                userId,
            );
            expect(rejected.status).toBe(409);

            const accepted = await enter(
                uniqueKey('rej-count-ok'),
                { BRONZE: 1 },
                WEIGHTED_EVENT_ID,
                userId,
            );
            expect(accepted.status).toBe(201);
            // 거절 건은 응모권을 차감하지 않았으므로 접수 건의 1장만 줄어든다
            expect((await ticketCounts(userId)).countByGrade.BRONZE).toBe(
                before.countByGrade.BRONZE - 1,
            );
        });
    });

    describe('응모 빈도 제한 (GD-146)', () => {
        it('짧은 창에 새 응모 요청이 몰리면 429와 Retry-After를 돌려준다', async () => {
            const userId = uniqueUser('rate');
            let last!: Awaited<ReturnType<typeof enter>>;
            for (let i = 0; i < 6; i += 1) {
                last = await enter(
                    uniqueKey(`rate-${i}`),
                    { BRONZE: 1 },
                    WEIGHTED_EVENT_ID,
                    userId,
                );
            }
            expect(last.status).toBe(429);
            expect(last.data).toMatchObject({
                success: false,
                code: 'RATE_LIMIT_EXCEEDED',
            });
            expect(Number(last.headers['retry-after'])).toBeGreaterThan(0);
        });

        it('같은 멱등키의 재전송은 새 요청으로 세지 않아 429가 나지 않는다', async () => {
            const userId = uniqueUser('idem-retry');
            const key = uniqueKey('idem-retry');

            const first = await enter(key, { BRONZE: 1 }, BRONZE_ONLY_EVENT_ID, userId);
            expect(first.status).toBe(201);

            // 저장된 키의 재전송은 재생이라 창 안에 몇 번을 보내도 제한에 걸리지 않는다
            for (let i = 0; i < 6; i += 1) {
                const retry = await enter(key, { BRONZE: 1 }, BRONZE_ONLY_EVENT_ID, userId);
                expect(retry.status).toBe(200);
            }
        });

        it('거절된 요청의 멱등키 재전송도 새 요청으로 세지 않고 처음 거절을 돌려준다', async () => {
            const userId = uniqueUser('idem-rej');
            const key = uniqueKey('idem-rej');

            const rejected = await enter(key, { GOLD: 2 }, WEIGHTED_EVENT_ID, userId);
            expect(rejected.status).toBe(409);

            for (let i = 0; i < 6; i += 1) {
                const retry = await enter(key, { GOLD: 2 }, WEIGHTED_EVENT_ID, userId);
                expect(retry.status).toBe(409);
                expect(retry.data).toEqual(rejected.data);
            }
        });
    });

    describe('E03 응모 통계', () => {
        interface Statistics {
            eventId: string;
            participantCount: number;
            totalSpentTicketCount: number;
            mySpentTicketCount: number;
            serverTime: string;
        }

        const statistics = async (eventId: string) => {
            const { data } = await apiClient.get<Envelope<Statistics>>(
                `/v1/events/${eventId}/statistics`,
            );
            return data;
        };

        it('공통 봉투에 EntryStatistics 필드를 담아 돌려준다', async () => {
            const body = await statistics('evt-011');
            expect(body.success).toBe(true);
            expect(body.data.eventId).toBe('evt-011');
            for (const value of [
                body.data.participantCount,
                body.data.totalSpentTicketCount,
                body.data.mySpentTicketCount,
            ]) {
                expect(Number.isInteger(value)).toBe(true);
            }
            expect(Number.isNaN(Date.parse(body.data.serverTime))).toBe(false);
            // 당첨 확률은 반환하지 않다
            expect(Object.keys(body.data)).not.toContain('winProbability');
        });

        it('응모가 접수되면 응모자 수가 오른다', async () => {
            const before = await statistics(FREE_EVENT_ID_FOR_STATS);
            const entered = await enter(
                uniqueKey('stat'),
                {},
                FREE_EVENT_ID_FOR_STATS,
                uniqueUser('stat'),
            );
            expect(entered.status).toBe(201);
            const after = await statistics(FREE_EVENT_ID_FOR_STATS);
            expect(after.data.participantCount).toBe(before.data.participantCount + 1);
        });

        it('본인 차감 수는 요청 사용자의 접수 기록만 센다', async () => {
            const userA = uniqueUser('mine-a');
            const userB = uniqueUser('mine-b');
            const entered = await enter(uniqueKey('mine'), { SILVER: 1 }, WEIGHTED_EVENT_ID, userA);
            expect(entered.status).toBe(201);

            const read = async (userId: string) => {
                const { data } = await apiClient.get<Envelope<Statistics>>(
                    `/v1/events/${WEIGHTED_EVENT_ID}/statistics`,
                    { headers: { 'X-User-ID': userId } },
                );
                return data.data.mySpentTicketCount;
            };
            expect(await read(userA)).toBe(1);
            expect(await read(userB)).toBe(0);
        });

        it('없는 이벤트는 404 봉투로 거절한다', async () => {
            const res = await apiClient.get('/v1/events/evt-none/statistics', {
                validateStatus: () => true,
            });
            expect(res.status).toBe(404);
            expect(res.data).toMatchObject({ success: false, code: 'ENTRY-004' });
        });
    });

    describe('E07 응모 자격 조회', () => {
        it('가중치 이벤트는 쓸 수 있는 전체 장수를 availableTicketBalance로 돌려준다', async () => {
            const result = await eligibility(WEIGHTED_EVENT_ID, uniqueUser('elig'));
            expect(result.eventId).toBe(WEIGHTED_EVENT_ID);
            expect(result.canEnter).toBe(true);
            expect(result.reasons).toEqual([]);
            expect(result.usedTicketCount).toBe(0);
            expect(result.remainingTicketLimit).toBe(5);
            // 시드 보유는 브론즈 7·실버 2·골드 1 — 가중치 이벤트는 세 등급 모두 쓸 수 있다
            expect(result.availableTicketBalance).toBe(10);
            expect(Number.isNaN(Date.parse(result.serverTime))).toBe(false);
        });

        it('미적용 이벤트는 availableTicketBalance가 브론즈 장수다', async () => {
            const result = await eligibility(BRONZE_ONLY_EVENT_ID_2, uniqueUser('elig'));
            expect(result.availableTicketBalance).toBe(7);
            // 1회 제한 이벤트라 남은 상한은 1이다
            expect(result.remainingTicketLimit).toBe(1);
        });

        it('응모권 미사용 이벤트는 수량 관련 값이 0이다', async () => {
            const result = await eligibility(FREE_EVENT_ID, uniqueUser('elig'));
            expect(result.canEnter).toBe(true);
            expect(result.usedTicketCount).toBe(0);
            expect(result.remainingTicketLimit).toBe(0);
            expect(result.availableTicketBalance).toBe(0);
        });

        it('이미 응모한 1회 이벤트는 ALREADY_ENTERED 이유를 돌려준다', async () => {
            const userId = uniqueUser('elig-entered');
            const entered = await enter(
                uniqueKey('elig-entered'),
                { BRONZE: 1 },
                BRONZE_ONLY_EVENT_ID_2,
                userId,
            );
            expect(entered.status).toBe(201);

            const result = await eligibility(BRONZE_ONLY_EVENT_ID_2, userId);
            expect(result.canEnter).toBe(false);
            expect(result.reasons).toContain('ALREADY_ENTERED');
            expect(result.usedTicketCount).toBe(1);
            expect(result.remainingTicketLimit).toBe(0);
        });

        it('브론즈가 없는 미적용 이벤트는 BRONZE_REQUIRED 이유를 돌려준다', async () => {
            const userId = uniqueUser('elig-no-bronze');
            const drainEvent = await createOpenEvent({ maxTicketsPerUser: null });
            await enter(uniqueKey('elig-drain'), { BRONZE: 7 }, drainEvent, userId);

            const result = await eligibility(BRONZE_ONLY_EVENT_ID_2, userId);
            expect(result.canEnter).toBe(false);
            expect(result.reasons).toContain('BRONZE_REQUIRED');
            expect(result.availableTicketBalance).toBe(0);
        });

        it('오픈 전 이벤트는 EVENT_NOT_OPEN 이유를 돌려준다', async () => {
            const result = await eligibility(UPCOMING_EVENT_ID, uniqueUser('elig'));
            expect(result.canEnter).toBe(false);
            expect(result.reasons).toContain('EVENT_NOT_OPEN');
        });

        it('관리자와 멤버십 미달 사용자에게는 각각 이유를 돌려준다', async () => {
            const admin = await eligibility(WEIGHTED_EVENT_ID, 'vu-admin');
            expect(admin.canEnter).toBe(false);
            expect(admin.reasons).toContain('ADMIN_ENTRY_FORBIDDEN');

            const low = await eligibility(VIP_EVENT_ID, uniqueUser('elig-vip'));
            expect(low.canEnter).toBe(false);
            expect(low.reasons).toContain('ENTRY_MEMBERSHIP_NOT_MET');
        });

        it('없는 이벤트는 404 봉투로 거절한다', async () => {
            const res = await apiClient.get('/v1/events/evt-none/eligibility', {
                validateStatus: () => true,
            });
            expect(res.status).toBe(404);
            expect(res.data).toMatchObject({ success: false });
        });
    });
});
