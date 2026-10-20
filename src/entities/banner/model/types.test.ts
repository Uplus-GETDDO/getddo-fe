import { describe, expect, it } from 'vitest';

import { adminBannerSchema, bannerSchema } from './types';

it('사용자 배너는 이전 미연결 행과 필수 필드 누락을 거절한다', () => {
    const banner = { id: 'banner', eventId: 'event', imageUrl: '/banner.png', displayOrder: 8 };
    expect(bannerSchema.parse(banner)).toEqual(banner);
    expect(bannerSchema.safeParse({ ...banner, eventId: null }).success).toBe(false);
    expect(bannerSchema.safeParse({ id: 'banner' }).success).toBe(false);
});

describe('이전 배너 조회 계약', () => {
    it.each([0, 10, 20])('보존된 순서 %s를 변환 없이 읽는다', (displayOrder) => {
        const banner = {
            id: 'legacy-banner',
            eventId: null,
            imageUrl: '/legacy.png',
            imageKey: 'legacy.png',
            displayOrder,
            createdAt: '2026-10-01T00:00:00Z',
            updatedAt: '2026-10-01T00:00:00Z',
        };
        expect(adminBannerSchema.parse(banner)).toEqual(banner);
    });
});
