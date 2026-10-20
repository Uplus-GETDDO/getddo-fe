import { describe, expect, it } from 'vitest';

import { adminUserSchema } from '@entities/user';
import { apiClient } from '@shared/api/client';
import { envelopeSchema, pageSchema } from '@shared/api/envelopeSchema';

/*
 * 관리자 사용자 조회 목업이 AO01·AO02 확정 계약(getddo-spec 05-api/user.md)을 지키는지 검증한다.
 * 경로는 리터럴로 적어 상수와 핸들러가 함께 틀려도 계약 위반이 드러나게 한다
 */
const ADMIN = { 'X-User-ID': 'vu-admin', 'X-User-Role': 'ADMIN' };

const get = (
    path: string,
    params?: Record<string, unknown>,
    headers: Record<string, string> = ADMIN,
) => apiClient.get<{ code: string }>(path, { params, headers, validateStatus: () => true });

const page = (body: unknown) => envelopeSchema(pageSchema(adminUserSchema)).parse(body).data;

describe('AO01 관리자 사용자 목록', () => {
    it('생성 시각 최신순으로 주고 totalElements는 필터에 맞는 전체 건수다', async () => {
        const all = page((await get('/v1/admin/users', { size: 100 })).data);
        const active = page(
            (await get('/v1/admin/users', { role: 'USER', status: 'ACTIVE', size: 1 })).data,
        );
        expect(all.items).toHaveLength(100);
        expect(active.items).toHaveLength(1);
        expect(active.totalElements).toBeGreaterThan(0);
        expect(active.totalElements).toBeLessThan(all.totalElements);
        const times = all.items.map((user) => user.createdAt);
        expect(times).toEqual([...times].sort().reverse());
    });

    it('필터를 AND로 적용하고 이름은 양끝 공백을 뺀 부분 검색이다', async () => {
        const data = page(
            (await get('/v1/admin/users', { keyword: ' 김 ', membership: 'vip', size: 100 })).data,
        );
        expect(data.items.length).toBeGreaterThan(0);
        expect(
            data.items.every((user) => user.name.includes('김') && user.membership === 'vip'),
        ).toBe(true);
    });

    it('조건 위반은 USER-008, 형식 오류는 COMMON-005, 관리자가 아니면 USER-009다', async () => {
        const tooBig = await get('/v1/admin/users', { size: 101 });
        const longKeyword = await get('/v1/admin/users', { keyword: '가'.repeat(21) });
        const badRole = await get('/v1/admin/users', { role: 'GUEST' });
        const user = await get('/v1/admin/users', undefined, {
            'X-User-ID': 'vu-doyoon',
            'X-User-Role': 'USER',
        });
        expect([tooBig.status, tooBig.data.code]).toEqual([400, 'USER-008']);
        expect([longKeyword.status, longKeyword.data.code]).toEqual([400, 'USER-008']);
        expect([badRole.status, badRole.data.code]).toEqual([400, 'COMMON-005']);
        expect([user.status, user.data.code]).toEqual([403, 'USER-009']);
    });
});

describe('AO02 관리자 사용자 상세', () => {
    it('있는 사용자는 AdminUser를, 없는 사용자는 404 USER-010을 준다', async () => {
        const found = await get('/v1/admin/users/vu-doyoon');
        const missing = await get('/v1/admin/users/nobody');
        expect(envelopeSchema(adminUserSchema).parse(found.data).data.name).toBe('김도윤');
        expect([missing.status, missing.data.code]).toEqual([404, 'USER-010']);
    });
});
