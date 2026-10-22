import type { ZodType } from 'zod';

import { describe, expect, it } from 'vitest';

import { abuseCaseDetailSchema, abuseCaseSchema } from '@entities/abuseCase';
import { apiClient } from '@shared/api/client';
import { envelopeSchema, pageSchema } from '@shared/api/envelopeSchema';

/*
 * 어뷰징 차단 내역 목업이 spec AR01·AR02 채택 계약(getddo-spec 05-api/abuse.md)을
 * 지키는지 검증한다. 경로는 리터럴로 적어 상수와 핸들러가 함께 틀려도 계약 위반이 드러나게 한다.
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

const USER_WITH_TWO_CASES = '10000000-0000-4000-8000-000000001042';
const CASE_ID = 'a0000000-0000-4000-8000-000000000001';

describe('AR01 차단 이력 목록', () => {
    it('채택 계약의 요약 필드를 싣고 blockedAt DESC로 내린다', async () => {
        const res = await get('/v1/admin/abuse-cases');
        expect(res.status).toBe(200);
        const data = page(abuseCaseSchema, res.data);
        expect(data.items.length).toBeGreaterThan(0);
        const first = data.items[0];
        expect(first).toMatchObject({
            sourceType: 'ENTRY',
            detectionType: 'REPEATED_RATE_LIMIT_EXCEEDED',
        });
        expect(first).not.toHaveProperty('target');
        expect(first).not.toHaveProperty('rewardSource');
        expect(first).not.toHaveProperty('detectedAt');
        expect(first).not.toHaveProperty('requestSummary');
        const times = data.items.map((i) => i.blockedAt);
        expect(times).toEqual([...times].sort().reverse());
    });

    it('userId·eventId·sourceType으로 거른다', async () => {
        const mine = page(
            abuseCaseSchema,
            (await get('/v1/admin/abuse-cases', { userId: USER_WITH_TWO_CASES })).data,
        );
        expect(mine.items.length).toBeGreaterThan(1);
        expect(mine.items.every((i) => i.userId === USER_WITH_TWO_CASES)).toBe(true);
        const byEvent = page(
            abuseCaseSchema,
            (
                await get('/v1/admin/abuse-cases', {
                    eventId: '20000000-0000-4000-8000-000000000201',
                })
            ).data,
        );
        expect(byEvent.items.length).toBeGreaterThan(0);
        expect(
            byEvent.items.every((i) => i.eventId === '20000000-0000-4000-8000-000000000201'),
        ).toBe(true);
        const entry = page(
            abuseCaseSchema,
            (await get('/v1/admin/abuse-cases', { sourceType: 'ENTRY' })).data,
        );
        expect(entry.items.every((i) => i.sourceType === 'ENTRY')).toBe(true);
        // 이번 계약에 없는 sourceType은 빈 페이지다
        const other = page(
            abuseCaseSchema,
            (await get('/v1/admin/abuse-cases', { sourceType: 'GAME' })).data,
        );
        expect(other.items).toEqual([]);
    });

    it('기간 필터는 blockedAt 기준 [from, to)다', async () => {
        const all = page(abuseCaseSchema, (await get('/v1/admin/abuse-cases')).data).items;
        const sorted = [...all].sort((a, b) => a.blockedAt.localeCompare(b.blockedAt));
        const second = sorted[1];
        if (!second) throw new Error('fixture missing');
        const res = await get('/v1/admin/abuse-cases', {
            from: sorted[0]?.blockedAt,
            to: second.blockedAt,
        });
        const ids = page(abuseCaseSchema, res.data).items.map((i) => i.id);
        expect(ids).toHaveLength(1);
        expect(ids).not.toContain(second.id);
    });

    it('시간대가 없거나 page·size가 범위를 벗어나면 400이다', async () => {
        expect((await get('/v1/admin/abuse-cases', { from: '2026-10-01T00:00:00' })).status).toBe(
            400,
        );
        expect(
            (
                await get('/v1/admin/abuse-cases', {
                    from: '2026-10-02T00:00:00Z',
                    to: '2026-10-01T00:00:00Z',
                })
            ).status,
        ).toBe(400);
        expect((await get('/v1/admin/abuse-cases', { size: 101 })).status).toBe(400);
        expect((await get('/v1/admin/abuse-cases', { page: 0 })).status).toBe(400);
    });
});

describe('AR02 차단 이력 상세', () => {
    it('요약 필드에 차단 판정 근거(evidence) 객체를 덧붙여 돌려준다', async () => {
        const res = await get(`/v1/admin/abuse-cases/${CASE_ID}`);
        expect(res.status).toBe(200);
        const data = envelopeSchema(abuseCaseDetailSchema).parse(res.data).data;
        expect(data.id).toBe(CASE_ID);
        expect(data.evidence.triggerScope).toMatch(/^(USER|EVENT)$/);
        expect(typeof data.evidence.ruleVersion).toBe('string');
        expect(typeof data.evidence.requestLimit).toBe('number');
        expect(typeof data.evidence.rejectedCount).toBe('number');
        expect(typeof data.evidence.rejectionThreshold).toBe('number');
        expect(
            Date.parse(data.evidence.windowStartedAt) <= Date.parse(data.evidence.windowEndsAt),
        ).toBe(true);
    });

    it('없는 차단 이력은 404다', async () => {
        const res = await get('/v1/admin/abuse-cases/00000000-0000-4000-8000-00000000ffff');
        expect(res.status).toBe(404);
        expect(res.data.success).toBe(false);
    });
});
