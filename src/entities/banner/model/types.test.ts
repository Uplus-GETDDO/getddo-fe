import { describe, expect, it } from 'vitest';

import { adminBannerSchema } from './types';

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
