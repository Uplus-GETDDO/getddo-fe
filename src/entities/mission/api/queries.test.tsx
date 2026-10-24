import type { ReactNode } from 'react';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { apiClient } from '@shared/api/client';

import { MISSIONS_KEY, useLatestMissions, useMissionList } from './queries';

afterEach(() => vi.restoreAllMocks());
const item = (n: number) => ({
    id: `m${n}`,
    title: `미션 ${n}`,
    imageUrl: null,
    missionType: 'QUIZ',
    startsAt: '2026-10-01T00:00:00Z',
    endsAt: '2026-11-01T00:00:00Z',
    rewardTicketCount: 1,
    completed: false,
    serverTime: '2026-10-20T00:00:00Z',
});
function setup() {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const wrapper = ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
    return { client, wrapper };
}
// 미션이 많은 서버 — 첫 페이지 뒤에도 페이지가 계속 남아 있다
function mockManyPages() {
    return vi.spyOn(apiClient, 'get').mockImplementation(async (_url, config) => {
        await Promise.resolve();
        const { page, size } = config?.params as { page: number; size: number };
        return {
            data: {
                success: true,
                data: {
                    page,
                    size,
                    totalElements: 4000,
                    items: Array.from({ length: size }, (_, n) => item((page - 1) * size + n)),
                },
            },
        };
    });
}

describe('최근 미션 첫 페이지', () => {
    it('미션이 많아도 첫 페이지(최대 100건)를 한 번만 받는다', async () => {
        const get = mockManyPages();
        const { wrapper } = setup();
        const hook = renderHook(() => useLatestMissions(), { wrapper });
        await waitFor(() => expect(hook.result.current.data).toHaveLength(100));
        expect(get).toHaveBeenCalledTimes(1);
        expect(get.mock.calls[0]?.[1]?.params).toEqual({ page: 1, size: 100 });
    });

    it('전체 목록과 캐시를 나눠 서로 덮어쓰지 않고, 미션 무효화에는 함께 걸린다', async () => {
        const get = mockManyPages();
        const { client, wrapper } = setup();
        const hook = renderHook(() => useLatestMissions(), { wrapper });
        await waitFor(() => expect(hook.result.current.data).toBeDefined());
        expect(client.getQueryData([...MISSIONS_KEY, 'list'])).toBeUndefined();
        // 제출 후 features가 MISSIONS_KEY로 무효화하면 첫 페이지도 다시 받는다
        await client.invalidateQueries({ queryKey: MISSIONS_KEY });
        expect(get).toHaveBeenCalledTimes(2);
    });
});

describe('미션 전체 목록', () => {
    it('totalElements까지 모은다', async () => {
        vi.spyOn(apiClient, 'get').mockImplementation(async (_url, config) => {
            await Promise.resolve();
            const { page } = config?.params as { page: number };
            return {
                data: {
                    success: true,
                    data: {
                        page,
                        size: 50,
                        totalElements: 51,
                        items:
                            page === 1 ? Array.from({ length: 50 }, (_, n) => item(n)) : [item(50)],
                    },
                },
            };
        });
        const { wrapper } = setup();
        const hook = renderHook(() => useMissionList(), { wrapper });
        await waitFor(() => expect(hook.result.current.data).toHaveLength(51));
    });
});
