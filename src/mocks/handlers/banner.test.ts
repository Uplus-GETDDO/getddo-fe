import { describe, expect, it } from 'vitest';

import { adminBannerListSchema, adminBannerSchema } from '@entities/banner';
import { apiClient } from '@shared/api/client';

interface Envelope<T> {
    success: boolean;
    code: string;
    data: T;
}

interface BannerBody {
    id: string;
    eventId: string;
    imageUrl: string;
    imageKey: string;
    displayOrder: number;
}

const call = (method: 'get' | 'post' | 'put' | 'delete', path: string, body?: unknown) =>
    apiClient.request<Envelope<unknown>>({
        method,
        url: path,
        data: body,
        validateStatus: () => true,
    });

const list = async () =>
    adminBannerListSchema.parse((await call('get', '/v1/admin/banners')).data).data;

// 목업은 모듈 수준 상태를 들고 있어 테스트끼리 영향을 준다 — 순서에 의존하는 하나의 시나리오로 묶는다
describe('배너 목업 핸들러', () => {
    it('1~N 순서이며 중간 삽입·이동·삭제 시 연속 순서를 유지한다', async () => {
        // 씨앗 배너가 최대(5개)까지 차 있어 등록할 자리를 하나 비우고 시작한다
        const seeds = await list();
        expect(seeds.map((item) => item.displayOrder)).toEqual([1, 2, 3, 4, 5]);
        await call('delete', `/v1/admin/banners/${seeds.at(-1)?.id}`);
        const before = await list();
        expect(before.map((item) => item.displayOrder)).toEqual([1, 2, 3, 4]);
        const res = await call('post', '/v1/admin/banners', {
            eventId: 'evt-001',
            imageKey: 'banners/insert.png',
            displayOrder: 2,
        });
        expect(res.status).toBe(201);
        const inserted = adminBannerSchema.parse(res.data.data);
        expect((await list()).map((item) => item.id)).toEqual([
            before[0]?.id,
            inserted.id,
            ...before.slice(1).map((item) => item.id),
        ]);
        const moved = await call('put', `/v1/admin/banners/${inserted.id}`, {
            eventId: 'evt-001',
            imageKey: inserted.imageKey,
            displayOrder: 5,
        });
        expect(moved.status).toBe(200);
        expect((await list()).map((item) => item.id)).toEqual([
            ...before.map((item) => item.id),
            inserted.id,
        ]);
        await call('put', `/v1/admin/banners/${inserted.id}`, {
            eventId: 'evt-001',
            imageKey: inserted.imageKey,
            displayOrder: 1,
        });
        expect((await list())[0]?.id).toBe(inserted.id);
        await call('delete', `/v1/admin/banners/${inserted.id}`);
        expect((await list()).map((item) => item.displayOrder)).toEqual([1, 2, 3, 4]);
        expect(adminBannerSchema.parse({ ...before[0], eventId: null }).eventId).toBeNull();
    });

    it('등록 0·N+2와 수정 0·N+1 순서는 거절한다', async () => {
        const before = await list();
        for (const displayOrder of [0, before.length + 2]) {
            const res = await call('post', '/v1/admin/banners', {
                eventId: 'evt-001',
                imageKey: 'banners/bad.png',
                displayOrder,
            });
            expect(res.status).toBe(400);
            expect(res.data.code).toBe('BANNER-001');
        }
        for (const displayOrder of [0, before.length + 1]) {
            const res = await call('put', `/v1/admin/banners/${before[0]?.id}`, {
                eventId: 'evt-001',
                imageKey: 'banners/bad.png',
                displayOrder,
            });
            expect(res.status).toBe(400);
            expect(res.data.code).toBe('BANNER-001');
        }
        expect((await list()).map((item) => item.id)).toEqual(before.map((item) => item.id));
    });

    it('관리자 목록이 노출 순서대로 오고 공개 목록과 같은 순서다', async () => {
        const banners = await list();
        expect(banners.length).toBeGreaterThan(0);
        expect(banners.map((b) => b.displayOrder)).toEqual(
            [...banners.map((b) => b.displayOrder)].sort((a, b) => a - b),
        );

        const publicRes = await call('get', '/v1/banners');
        const publicBanners = (publicRes.data as Envelope<BannerBody[]>).data;
        expect(publicBanners.map((b) => b.id)).toEqual(banners.map((b) => b.id));
        // 공개 DTO에는 imageKey 같은 관리자 필드가 없다
        expect(publicBanners[0]).not.toHaveProperty('imageKey');
    });

    it('등록은 입력을 검증하고 5개를 넘으면 409로 거절한다', async () => {
        const invalid = await call('post', '/v1/admin/banners', {
            eventId: 'evt-001',
            imageKey: '',
            displayOrder: 1,
        });
        expect(invalid.status).toBe(400);

        const missingEvent = await call('post', '/v1/admin/banners', {
            eventId: 'evt-없음',
            imageKey: 'banners/x.png',
            displayOrder: 1,
        });
        expect(missingEvent.status).toBe(404);

        let count = (await list()).length;
        while (count < 5) {
            const res = await call('post', '/v1/admin/banners', {
                eventId: 'evt-001',
                imageKey: `banners/new-${count}.png`,
                displayOrder: count + 1,
            });
            expect(res.status).toBe(201);
            adminBannerSchema.parse(res.data.data);
            count += 1;
        }

        const over = await call('post', '/v1/admin/banners', {
            eventId: 'evt-001',
            imageKey: 'banners/over.png',
            displayOrder: 5,
        });
        expect(over.status).toBe(409);
        expect(over.data.code).toBe('BANNER-004');
        expect((await list()).length).toBe(5);
    });

    it('수정은 필드를 바꾸고 없는 배너는 404다', async () => {
        const [first] = await list();
        const res = await call('put', `/v1/admin/banners/${first?.id}`, {
            eventId: 'evt-002',
            imageKey: 'banners/edited.png',
            displayOrder: first?.displayOrder,
        });
        expect(res.status).toBe(200);
        const updated = adminBannerSchema.parse(res.data.data);
        expect(updated.eventId).toBe('evt-002');
        expect(updated.imageKey).toBe('banners/edited.png');

        const missing = await call('put', '/v1/admin/banners/없는-배너', {
            eventId: 'evt-001',
            imageKey: 'banners/x.png',
            displayOrder: 1,
        });
        expect(missing.status).toBe(404);
    });

    it('순서 변경은 전체 ID를 받아 반영하고 목록과 어긋나면 409다', async () => {
        const before = (await list()).map((b) => b.id);
        const reversed = [...before].reverse();

        const res = await call('put', '/v1/admin/banners/order', { bannerIds: reversed });
        expect(res.status).toBe(200);
        const after = adminBannerListSchema.parse(res.data).data;
        expect(after.map((b) => b.id)).toEqual(reversed);
        expect(after.map((b) => b.displayOrder)).toEqual(after.map((_, index) => index + 1));
        expect((await list()).map((b) => b.id)).toEqual(reversed);

        // 일부 누락·중복·모르는 ID는 모두 거절하고 기존 순서를 유지한다
        const partial = await call('put', '/v1/admin/banners/order', {
            bannerIds: reversed.slice(1),
        });
        expect(partial.status).toBe(409);
        expect(partial.data.code).toBe('BANNER-005');
        const duplicated = await call('put', '/v1/admin/banners/order', {
            bannerIds: [reversed[0], ...reversed.slice(0, -1)],
        });
        expect(duplicated.status).toBe(409);
        expect((await list()).map((b) => b.id)).toEqual(reversed);
    });

    it('삭제하면 목록에서 사라지고 다시 삭제하면 404다', async () => {
        const [target] = await list();
        const res = await call('delete', `/v1/admin/banners/${target?.id}`);
        expect(res.status).toBe(200);
        expect((await list()).some((b) => b.id === target?.id)).toBe(false);
        const remaining = await list();
        expect(remaining.map((b) => b.displayOrder)).toEqual(
            remaining.map((_, index) => index + 1),
        );

        const again = await call('delete', `/v1/admin/banners/${target?.id}`);
        expect(again.status).toBe(404);
    });

    it('이벤트를 삭제하면 사용자에게 숨기고 관리자 배너는 보존한다', async () => {
        const create = await call('post', '/v1/admin/events', {
            title: '배너 연동 삭제 테스트',
            description: '테스트용 이벤트입니다',
            imageKey: null,
            eventType: 'NO_TICKET',
            weightingEnabled: false,
            maxTicketsPerUser: null,
            membershipRule: 'excellent',
            startsAt: '2099-06-01T00:00:00Z',
            endsAt: '2099-06-02T00:00:00Z',
            prizes: [{ rank: 1, name: '경품', winnerCount: 1, description: null, imageKey: null }],
        });
        expect(create.status).toBe(201);
        const eventId = (create.data as Envelope<{ id: string }>).data.id;

        const banner = await call('post', '/v1/admin/banners', {
            eventId,
            imageKey: 'banners/linked.png',
            displayOrder: 1,
        });
        expect(banner.status).toBe(201);

        expect((await call('delete', `/v1/admin/events/${eventId}`)).status).toBe(200);
        expect((await list()).some((b) => b.eventId === eventId)).toBe(true);
        const publicBanners = (await call('get', '/v1/banners')).data as Envelope<BannerBody[]>;
        expect(publicBanners.data.some((b) => b.eventId === eventId)).toBe(false);
    });
});

describe('취소 이벤트 배너', () => {
    it('취소 후 관리자 행과 상대 순서를 보존하고 신규 연결을 거절한다', async () => {
        const before = await list();
        expect(
            (await call('post', '/v1/admin/events/evt-002/cancel', { reason: '배너 숨김 테스트' }))
                .status,
        ).toBe(200);
        expect((await list()).map((item) => item.id)).toEqual(before.map((item) => item.id));
        const publicItems = ((await call('get', '/v1/banners')).data as Envelope<BannerBody[]>)
            .data;
        expect(publicItems.some((item) => item.eventId === 'evt-002')).toBe(false);
        expect(
            publicItems.every((item) =>
                before.some(
                    (banner) => banner.id === item.id && banner.displayOrder === item.displayOrder,
                ),
            ),
        ).toBe(true);
        const res = await call('put', `/v1/admin/banners/${before[0]?.id}`, {
            eventId: 'evt-002',
            imageKey: 'banners/canceled.png',
            displayOrder: 1,
        });
        expect(res.status).toBe(409);
        expect(res.data.code).toBe('BANNER-007');
    });
});
