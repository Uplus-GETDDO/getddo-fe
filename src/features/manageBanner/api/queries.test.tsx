import type { ReactNode } from 'react';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { adminBannerSchema, useAdminBanners, useBanners } from '@entities/banner';
import { apiClient } from '@shared/api/client';

import { useCreateBanner, useDeleteBanner, useReorderBanners, useUpdateBanner } from './queries';

const wrapper = (client: QueryClient) =>
    function Provider({ children }: { children: ReactNode }) {
        return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
    };

describe('배너 관리와 홈 갱신', () => {
    it('등록·수정·순서·삭제는 같은 세션을 갱신하고 다른 세션은 재조회 후 반영한다', async () => {
        const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
        const otherClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
        const home = renderHook(() => useBanners(), { wrapper: wrapper(client) });
        const other = renderHook(() => useBanners(), { wrapper: wrapper(otherClient) });
        const admin = renderHook(
            () => ({
                list: useAdminBanners(),
                create: useCreateBanner(),
                update: useUpdateBanner(),
                reorder: useReorderBanners(),
                remove: useDeleteBanner(),
            }),
            { wrapper: wrapper(client) },
        );
        let createdId: string | undefined;
        try {
            await waitFor(() => expect(home.result.current.data).toHaveLength(3));
            await waitFor(() => expect(other.result.current.data).toHaveLength(3));
            await waitFor(() => expect(admin.result.current.list.data).toHaveLength(3));
            await act(async () => {
                const created = await admin.result.current.create.mutateAsync({
                    eventId: 'evt-001',
                    imageKey: 'isolated-GD-255.png',
                    displayOrder: 1,
                });
                createdId = created.id;
            });
            await waitFor(() => expect(admin.result.current.list.data?.[0]?.id).toBe(createdId));
            await waitFor(() => expect(home.result.current.data?.[0]?.id).toBe(createdId));
            expect(other.result.current.data).toHaveLength(3);
            await act(async () => {
                await other.result.current.refetch();
            });
            await waitFor(() => expect(other.result.current.data?.[0]?.id).toBe(createdId));

            await act(async () => {
                await admin.result.current.update.mutateAsync({
                    bannerId: createdId!,
                    body: { eventId: 'evt-002', imageKey: 'isolated-edited.png', displayOrder: 1 },
                });
            });
            await waitFor(() => expect(home.result.current.data?.[0]?.eventId).toBe('evt-002'));
            const order = admin.result.current.list.data!.map((banner) => banner.id).reverse();
            await act(async () => {
                await admin.result.current.reorder.mutateAsync(order);
            });
            await waitFor(() =>
                expect(home.result.current.data?.map((banner) => banner.id)).toEqual(order),
            );

            await act(async () => {
                await admin.result.current.remove.mutateAsync(createdId!);
            });
            await waitFor(() =>
                expect(home.result.current.data?.some((banner) => banner.id === createdId)).toBe(
                    false,
                ),
            );
            expect(other.result.current.data?.some((banner) => banner.id === createdId)).toBe(true);
            await act(async () => {
                await other.result.current.refetch();
            });
            await waitFor(() =>
                expect(other.result.current.data?.some((banner) => banner.id === createdId)).toBe(
                    false,
                ),
            );
            createdId = undefined;
        } finally {
            if (createdId) await apiClient.delete(`/v1/admin/banners/${createdId}`);
            home.unmount();
            other.unmount();
            admin.unmount();
            client.clear();
            otherClient.clear();
        }
    });

    it('동시 목록 변경으로 전체 순서가 충돌하면 관리자 최신 목록을 다시 받는다', async () => {
        const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
        const admin = renderHook(
            () => ({ list: useAdminBanners(), reorder: useReorderBanners() }),
            { wrapper: wrapper(client) },
        );
        let createdId: string | undefined;
        try {
            await waitFor(() => expect(admin.result.current.list.data).toHaveLength(3));
            const staleIds = admin.result.current.list.data!.map((banner) => banner.id);
            const response = await apiClient.post<{ data: unknown }>('/v1/admin/banners', {
                eventId: 'evt-001',
                imageKey: 'concurrent.png',
                displayOrder: 1,
            });
            createdId = adminBannerSchema.parse(response.data.data).id;
            await act(async () => {
                await expect(
                    admin.result.current.reorder.mutateAsync(staleIds),
                ).rejects.toMatchObject({ status: 409, code: 'BANNER-005' });
            });
            await waitFor(() => expect(admin.result.current.list.data).toHaveLength(4));
            await waitFor(() => expect(admin.result.current.list.data?.[0]?.id).toBe(createdId));
        } finally {
            if (createdId) await apiClient.delete(`/v1/admin/banners/${createdId}`);
            admin.unmount();
            client.clear();
        }
    });
});
