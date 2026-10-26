import type { ZodType } from 'zod';

import { describe, expect, it } from 'vitest';

import { adminTicketHistorySchema } from '@entities/ticket';
import { apiClient } from '@shared/api/client';
import { envelopeSchema, pageSchema } from '@shared/api/envelopeSchema';

/*
 * 관리자 응모권 목업이 2026-10-12 백엔드 답변(AO05)을 지키는지 검증한다.
 * 경로는 리터럴로 적어 상수와 핸들러가 함께 틀려도 계약 위반이 드러나게 한다.
 * AO03·AO04·AO08·AO09 목업은 GD-293에서 화면과 함께 걷었다 — 계약은 채택 상태로 남는다
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

    it('기간은 [from, to)이고 시간대 없는 값·역순 범위는 400이다', async () => {
        const all = page(
            adminTicketHistorySchema,
            (await get('/v1/admin/ticket-histories', { size: 100 })).data,
        ).items;
        const sorted = [...all].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
        const second = sorted[1];
        if (!second) throw new Error('seed missing');
        const res = await get('/v1/admin/ticket-histories', {
            size: 100,
            from: sorted[0]?.createdAt,
            to: second.createdAt,
        });
        const ids = page(adminTicketHistorySchema, res.data).items.map((h) => h.id);
        expect(ids).toHaveLength(1);
        expect(ids).not.toContain(second.id);

        expect(
            (await get('/v1/admin/ticket-histories', { from: '2026-10-01T00:00:00' })).status,
        ).toBe(400);
        expect(
            (
                await get('/v1/admin/ticket-histories', {
                    from: '2026-10-02T00:00:00Z',
                    to: '2026-10-01T00:00:00Z',
                })
            ).status,
        ).toBe(400);
    });

    it('내부 필드는 응답에 노출하지 않는다', async () => {
        const res = await get('/v1/admin/ticket-histories');
        expect(res.data.data.items[0]).not.toHaveProperty('version');
        expect(res.data.data.items[0]).not.toHaveProperty('sourceType');
    });
});
