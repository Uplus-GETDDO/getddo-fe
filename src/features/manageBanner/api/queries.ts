import { useMutation, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';

import type { BannerWrite } from '@entities/banner';

import {
    ADMIN_BANNERS_API_PATH,
    ADMIN_BANNERS_KEY,
    ADMIN_BANNERS_ORDER_API_PATH,
    adminBannerApiPath,
    adminBannerListSchema,
    adminBannerSchema,
    BANNERS_KEY,
} from '@entities/banner';
import { apiClient } from '@shared/api/client';
import { envelopeSchema } from '@shared/api/envelopeSchema';

// 모든 변경은 서버의 최신 목록으로 다시 맞춘다 — 순서(displayOrder)는 서버가 정한다
function useInvalidateBanners() {
    const queryClient = useQueryClient();
    // Promise를 반환해 재조회가 끝날 때까지 mutation을 pending으로 유지한다 — 순서 변경이 이전 목록으로 계산되지 않게
    return () =>
        Promise.all([
            queryClient.invalidateQueries({ queryKey: ADMIN_BANNERS_KEY }),
            queryClient.invalidateQueries({ queryKey: BANNERS_KEY }),
        ]);
}

export function useCreateBanner() {
    const invalidate = useInvalidateBanners();

    return useMutation({
        mutationFn: async (body: BannerWrite) => {
            const { data } = await apiClient.post<unknown>(ADMIN_BANNERS_API_PATH, body);
            return envelopeSchema(adminBannerSchema).parse(data).data;
        },
        onSuccess: invalidate,
    });
}

export function useUpdateBanner() {
    const invalidate = useInvalidateBanners();

    return useMutation({
        mutationFn: async ({ bannerId, body }: { bannerId: string; body: BannerWrite }) => {
            const { data } = await apiClient.put<unknown>(adminBannerApiPath(bannerId), body);
            return envelopeSchema(adminBannerSchema).parse(data).data;
        },
        onSuccess: invalidate,
    });
}

export function useDeleteBanner() {
    const invalidate = useInvalidateBanners();

    return useMutation({
        mutationFn: async (bannerId: string) => {
            const { data } = await apiClient.delete<unknown>(adminBannerApiPath(bannerId));
            return envelopeSchema(z.nullable(z.unknown())).parse(data).data;
        },
        onSuccess: invalidate,
    });
}

/** AB05 — 현재 배너 전체 ID를 노출 순서대로 보낸다. 서버가 목록과 어긋나면 409로 거절한다 */
export function useReorderBanners() {
    const invalidate = useInvalidateBanners();

    return useMutation({
        mutationFn: async (bannerIds: string[]) => {
            const { data } = await apiClient.put<unknown>(ADMIN_BANNERS_ORDER_API_PATH, {
                bannerIds,
            });
            return adminBannerListSchema.parse(data).data;
        },
        // 어긋남(409)으로 실패해도 서버의 현재 순서를 다시 받아 화면을 맞춘다
        onSettled: invalidate,
    });
}
