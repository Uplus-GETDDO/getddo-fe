import type { ReactNode } from 'react';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { apiClient } from '@shared/api/client';

import { useEventList } from './queries';

afterEach(() => vi.restoreAllMocks());
const item = (n: number) => ({
    id: `e${n}`,
    title: `이벤트 ${n}`,
    imageUrl: null,
    eventType: 'TICKET',
    weightingEnabled: true,
    membershipRule: 'excellent',
    startsAt: '2026-10-01T00:00:00Z',
    endsAt: '2026-11-01T00:00:00Z',
    status: 'CANCELED',
    serverTime: '2026-10-20T00:00:00Z',
    myEntered: true,
});
function setup() {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const wrapper = ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
    return { client, wrapper };
}

describe('이벤트 전체 수집', () => {
    it('마지막 페이지까지 수집하고 중간 페이지 유실을 전체 목록으로 확정하지 않는다', async () => {
        let missing = false;
        vi.spyOn(apiClient, 'get').mockImplementation(async (_url, config) => {
            await Promise.resolve();
            const page = Number((config?.params as { page: number }).page);
            return {
                data: {
                    success: true,
                    data: {
                        page,
                        size: 20,
                        totalElements: 21,
                        items:
                            page === 1
                                ? Array.from({ length: 20 }, (_, n) => item(n))
                                : missing
                                  ? []
                                  : [item(20)],
                    },
                },
            };
        });
        const { client, wrapper } = setup();
        const hook = renderHook(() => ({ ...useEventList() }), { wrapper });
        await waitFor(() => expect(hook.result.current.data).toHaveLength(21));
        const previous = hook.result.current.dataUpdatedAt;
        missing = true;
        await act(async () => {
            await hook.result.current.refetch();
        });
        await waitFor(() => expect(hook.result.current.isError).toBe(true));
        expect(hook.result.current.data).toHaveLength(21);
        expect(hook.result.current.dataUpdatedAt).toBe(previous);
        hook.unmount();
        client.clear();
    });
});
