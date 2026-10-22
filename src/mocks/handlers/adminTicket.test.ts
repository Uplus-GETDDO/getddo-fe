import type { ZodType } from 'zod';

import { afterEach, describe, expect, it } from 'vitest';

import {
    adminTicketHistorySchema,
    ticketConsistencySchema,
    ticketGrantSchema,
    ticketInconsistencySchema,
    ticketRefundSchema,
} from '@entities/ticket';
import { apiClient } from '@shared/api/client';
import { envelopeSchema, pageSchema } from '@shared/api/envelopeSchema';

import { adminTicketStore, resetAdminTicketStore } from './adminTicket';

/*
 * 관리자 응모권 목업이 2026-10-12 백엔드 답변(AO03·AO04·AO05·AO08·AO09)을 지키는지 검증한다.
 * 경로는 리터럴로 적어 상수와 핸들러가 함께 틀려도 계약 위반이 드러나게 한다.
 */

interface RawBody {
    success: boolean;
    code: string;
    data: { items: Record<string, unknown>[] };
}

const get = (path: string, params?: Record<string, unknown>) =>
    apiClient.get<RawBody>(path, { params, validateStatus: () => true });

const page = <T extends ZodType>(schema: T, body: unknown) =>
    envelopeSchema(pageSchema(schema)).parse(body).data;

afterEach(resetAdminTicketStore);

// 지급 행 수 — 고정 시드에 대시보드 추이용 최근 지급이 더해지므로 기댓값을 저장소에서 센다
const grantRows = (
    match: (h: (typeof adminTicketStore.histories)[number]) => boolean = () => true,
) => adminTicketStore.histories.filter((h) => h.operationType === 'GRANT' && match(h)).length;

describe('AO09 전체 불일치 목록', () => {
    it('시드된 불일치 응모권만 상태와 버전 비교 값과 함께 반환한다', async () => {
        const res = await get('/v1/admin/tickets/inconsistencies');
        expect(res.status).toBe(200);
        const data = page(ticketInconsistencySchema, res.data);
        expect(data.items.map((i) => i.ticketId)).toEqual(['tk-007', 'tk-010', 'tk-013', 'tk-016']);
        const statusDrift = data.items.find((i) => i.ticketId === 'tk-007');
        expect(statusDrift).toMatchObject({
            ticketVersion: 2,
            latestHistoryVersion: 2,
            ticketStatus: 'AVAILABLE',
            latestHistoryStatus: 'SPENT',
        });
        const versionDrift = data.items.find((i) => i.ticketId === 'tk-010');
        expect(versionDrift?.ticketVersion).not.toBe(versionDrift?.latestHistoryVersion);
        // 이력이 한 건도 없는 응모권도 불일치다 — 버전 0·상태 null이다 (spec AO04)
        const noHistory = data.items.find((i) => i.ticketId === 'tk-016');
        expect(noHistory).toMatchObject({
            latestHistoryVersion: 0,
            latestHistoryStatus: null,
        });
    });

    it('데이터를 고치면 결과가 달라진다 — 상수가 아니다', async () => {
        const target = adminTicketStore.tickets.find((t) => t.id === 'tk-007');
        if (!target) throw new Error('seed missing');
        target.status = 'SPENT';
        const res = await get('/v1/admin/tickets/inconsistencies');
        const ids = page(ticketInconsistencySchema, res.data).items.map((i) => i.ticketId);
        expect(ids).not.toContain('tk-007');
        expect(ids).toHaveLength(3);
    });

    it('userId로 거르고 불일치가 없으면 빈 페이지다', async () => {
        const mine = await get('/v1/admin/tickets/inconsistencies', { userId: 'vu-haneul' });
        expect(page(ticketInconsistencySchema, mine.data).items).toHaveLength(1);
        const none = await get('/v1/admin/tickets/inconsistencies', { userId: 'vu-doyoon' });
        const data = page(ticketInconsistencySchema, none.data);
        expect(data.items).toEqual([]);
        expect(data.totalElements).toBe(0);
    });
});

describe('AO04 사용자별 정합성', () => {
    it('불일치 사용자는 isConsistent=false와 불일치 응모권을 돌려준다', async () => {
        const res = await get('/v1/admin/users/vu-haneul/tickets/consistency');
        const data = envelopeSchema(ticketConsistencySchema).parse(res.data).data;
        expect(data.isConsistent).toBe(false);
        expect(data.inconsistencies).toHaveLength(1);
        expect(data.inconsistencies[0]).toMatchObject({
            ticketId: 'tk-007',
            ticketStatus: 'AVAILABLE',
            latestHistoryStatus: 'SPENT',
        });
    });

    it('일치 사용자는 isConsistent=true이고 목록이 비어 있다', async () => {
        const res = await get('/v1/admin/users/vu-doyoon/tickets/consistency');
        const data = envelopeSchema(ticketConsistencySchema).parse(res.data).data;
        expect(data.isConsistent).toBe(true);
        expect(data.inconsistencies).toEqual([]);
    });

    it('판정은 데이터에서 계산된다 — 일치하던 사용자도 값이 어긋나면 불일치다', async () => {
        const target = adminTicketStore.tickets.find((t) => t.userId === 'vu-doyoon');
        if (!target) throw new Error('seed missing');
        target.version += 1;
        const res = await get('/v1/admin/users/vu-doyoon/tickets/consistency');
        expect(envelopeSchema(ticketConsistencySchema).parse(res.data).data.isConsistent).toBe(
            false,
        );
    });

    it('없는 사용자는 404다', async () => {
        const res = await get('/v1/admin/users/nobody/tickets/consistency');
        expect(res.status).toBe(404);
        expect(res.data.success).toBe(false);
    });
});

describe('AO03 지급 이력', () => {
    it('GRANT 이력만 최신순으로 반환한다', async () => {
        const res = await get('/v1/admin/ticket-grants', { size: 100 });
        const data = page(ticketGrantSchema, res.data);
        expect(data.totalElements).toBe(grantRows());
        const times = data.items.map((g) => g.grantedAt);
        expect(times).toEqual([...times].sort().reverse());
    });

    it('keyword는 이름 부분일치, userId는 정확 일치다', async () => {
        const byName = page(
            ticketGrantSchema,
            (await get('/v1/admin/ticket-grants', { keyword: '서연' })).data,
        );
        expect(byName.items.every((g) => g.userName === '박서연')).toBe(true);
        expect(byName.totalElements).toBe(grantRows((h) => h.userName === '박서연'));
        const byId = page(
            ticketGrantSchema,
            (await get('/v1/admin/ticket-grants', { userId: 'vu-yuna' })).data,
        );
        expect(byId.totalElements).toBe(grantRows((h) => h.userId === 'vu-yuna'));
    });

    it('missionId를 쓰면 MISSION 행만 반환한다', async () => {
        const res = await get('/v1/admin/ticket-grants', { missionId: 'ms-quiz' });
        const data = page(ticketGrantSchema, res.data);
        expect(data.totalElements).toBe(grantRows((h) => h.missionId === 'ms-quiz'));
        expect(
            data.items.every((g) => g.sourceType === 'MISSION' && g.missionId === 'ms-quiz'),
        ).toBe(true);
    });

    it('sourceType과 grade 필터를 적용한다', async () => {
        const game = page(
            ticketGrantSchema,
            (await get('/v1/admin/ticket-grants', { sourceType: 'GAME' })).data,
        );
        expect(game.items.every((g) => g.sourceType === 'GAME')).toBe(true);
        const gold = page(
            ticketGrantSchema,
            (await get('/v1/admin/ticket-grants', { grade: 'GOLD' })).data,
        );
        expect(gold.totalElements).toBe(grantRows((h) => h.grade === 'GOLD'));
    });

    it('기간은 [from, to)이다', async () => {
        const all = page(
            ticketGrantSchema,
            (await get('/v1/admin/ticket-grants', { size: 100 })).data,
        ).items;
        const sorted = [...all].sort((a, b) => a.grantedAt.localeCompare(b.grantedAt));
        const second = sorted[1];
        if (!second) throw new Error('seed missing');
        const res = await get('/v1/admin/ticket-grants', {
            size: 100,
            from: sorted[0]?.grantedAt,
            to: second.grantedAt,
        });
        const ids = page(ticketGrantSchema, res.data).items.map((g) => g.historyId);
        expect(ids).toHaveLength(1);
        expect(ids).not.toContain(second.historyId);
    });

    it('시간대가 없거나 from이 to 이상이면 400이다', async () => {
        expect((await get('/v1/admin/ticket-grants', { from: '2026-10-01T00:00:00' })).status).toBe(
            400,
        );
        const res = await get('/v1/admin/ticket-grants', {
            from: '2026-10-02T00:00:00Z',
            to: '2026-10-01T00:00:00Z',
        });
        expect(res.status).toBe(400);
        expect(res.data.code).toBe('TICKET-004');
    });

    it('page와 size가 범위를 벗어나면 400이다', async () => {
        expect((await get('/v1/admin/ticket-grants', { size: 101 })).status).toBe(400);
        expect((await get('/v1/admin/ticket-grants', { page: 0 })).status).toBe(400);
    });

    it('페이지는 1부터 나뉜다', async () => {
        const data = page(
            ticketGrantSchema,
            (await get('/v1/admin/ticket-grants', { page: 2, size: 10 })).data,
        );
        expect(data.page).toBe(2);
        expect(data.items).toHaveLength(Math.min(10, grantRows() - 10));
        expect(data.totalElements).toBe(grantRows());
    });
});

describe('AO05 전체 이력', () => {
    it('이름 필드를 싣고 최신순으로 반환한다', async () => {
        const res = await get('/v1/admin/ticket-histories', { size: 100 });
        const data = page(adminTicketHistorySchema, res.data);
        expect(data.items[0]?.userName).toBeTruthy();
        const times = data.items.map((h) => h.createdAt);
        expect(times).toEqual([...times].sort().reverse());
    });

    it('operationType·eventId·missionId·userId 필터를 적용한다', async () => {
        const list = async (params: Record<string, unknown>) =>
            page(adminTicketHistorySchema, (await get('/v1/admin/ticket-histories', params)).data);
        const use = await list({ operationType: 'USE', size: 100 });
        expect(use.items.length).toBeGreaterThan(0);
        expect(use.items.every((h) => h.operationType === 'USE')).toBe(true);
        const event = await list({ eventId: 'evt-201', size: 100 });
        expect(event.items.length).toBeGreaterThan(0);
        expect(event.items.every((h) => h.eventId === 'evt-201')).toBe(true);
        const mission = await list({ missionId: 'ms-survey' });
        expect(mission.items.length).toBeGreaterThan(0);
        expect(mission.items.every((h) => h.missionTitle === '만족도 설문')).toBe(true);
        const user = await list({ userId: 'vu-jiwoo', size: 100 });
        expect(user.items.length).toBeGreaterThan(0);
        expect(user.items.every((h) => h.userId === 'vu-jiwoo')).toBe(true);
    });

    it('내부 필드(version 등)는 응답에 노출하지 않는다', async () => {
        const res = await get('/v1/admin/ticket-histories');
        expect(res.data.data.items[0]).not.toHaveProperty('version');
        expect(res.data.data.items[0]).not.toHaveProperty('sourceType');
    });
});

describe('AO08 반환 이력', () => {
    it('상태·재시도 필드 없이 반환 정보를 돌려준다', async () => {
        const res = await get('/v1/admin/ticket-refunds', { size: 100 });
        const data = page(ticketRefundSchema, res.data);
        expect(data.totalElements).toBe(adminTicketStore.refunds.length);
        expect(data.items[0]).not.toHaveProperty('status');
        expect(data.items[0]).not.toHaveProperty('attemptCount');
        expect(data.items.every((r) => r.reasonType === 'EVENT_CANCELED')).toBe(true);
        // 반환 대상 이력에 만료 시각이 없는 행은 targetExpiresAt이 null이다 (spec AO08)
        expect(data.items.some((r) => r.targetExpiresAt === null)).toBe(true);
    });

    it('eventId·userId·기간으로 거른다', async () => {
        const event = page(
            ticketRefundSchema,
            (await get('/v1/admin/ticket-refunds', { eventId: 'evt-201' })).data,
        );
        expect(event.items.every((r) => r.eventId === 'evt-201')).toBe(true);
        const none = page(
            ticketRefundSchema,
            (await get('/v1/admin/ticket-refunds', { userId: 'vu-yuna' })).data,
        );
        expect(none.items).toEqual([]);
        expect((await get('/v1/admin/ticket-refunds', { from: 'bad' })).status).toBe(400);
    });
});
