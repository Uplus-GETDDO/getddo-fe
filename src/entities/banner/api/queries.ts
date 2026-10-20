import { useQuery } from '@tanstack/react-query';
import { z } from 'zod';

import { apiClient } from '@shared/api/client';
import { envelopeSchema } from '@shared/api/envelopeSchema';
import { queryPresets } from '@shared/api/queryPresets';

import { adminBannerSchema, bannerSchema } from '../model/types';

export const BANNERS_KEY = ['banners'] as const;
export const BANNERS_API_PATH = '/v1/banners';
export const bannerListSchema = envelopeSchema(z.array(bannerSchema));

export function useBanners() {
    return useQuery({
        ...queryPresets.noCache,
        queryKey: BANNERS_KEY,
        refetchOnWindowFocus: 'always',
        queryFn: async () => {
            const { data } = await apiClient.get<unknown>(BANNERS_API_PATH);
            // 숨김 뒤 비연속 순서도 서버 배열 그대로 표시한다.
            return bannerListSchema.parse(data).data;
        },
    });
}

// AB01은 배열을 data에 싣는다(최대 5개라 Page가 아니다) — 표시 순서는 서버가 정한 그대로 쓴다
export const adminBannerListSchema = envelopeSchema(z.array(adminBannerSchema));

export const ADMIN_BANNERS_KEY = ['admin', 'banners'] as const;

// 관리자 배너 엔드포인트 — AB01~AB05 (getddo-spec 05-api/banner.md 초안)
export const ADMIN_BANNERS_API_PATH = '/v1/admin/banners';
export const adminBannerApiPath = (bannerId: string) => `${ADMIN_BANNERS_API_PATH}/${bannerId}`;
export const ADMIN_BANNERS_ORDER_API_PATH = `${ADMIN_BANNERS_API_PATH}/order`;

export function useAdminBanners() {
    return useQuery({
        // 순서 변경·삭제 판단은 항상 서버의 최신 목록 기준이어야 한다
        ...queryPresets.noCache,
        queryKey: ADMIN_BANNERS_KEY,
        queryFn: async () => {
            const { data } = await apiClient.get<unknown>(ADMIN_BANNERS_API_PATH);
            return adminBannerListSchema.parse(data).data;
        },
    });
}
