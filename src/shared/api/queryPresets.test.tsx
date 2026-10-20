import type { ReactNode } from 'react';

import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';

import { queryPresets } from './queryPresets';

function setup() {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const wrapper = ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
    return { client, wrapper };
}

describe('queryPresets.paged', () => {
    it('다음 페이지를 받는 동안 이전 목록을 둔다', async () => {
        const { wrapper } = setup();
        let resolveNext: (value: string[]) => void = () => {};
        const { result, rerender } = renderHook(
            ({ page }) =>
                useQuery({
                    ...queryPresets.paged,
                    queryKey: ['list', page],
                    queryFn: () =>
                        page === 1
                            ? Promise.resolve(['1쪽'])
                            : new Promise<string[]>((resolve) => (resolveNext = resolve)),
                }),
            { wrapper, initialProps: { page: 1 } },
        );
        await waitFor(() => expect(result.current.data).toEqual(['1쪽']));

        rerender({ page: 2 });
        expect(result.current.data).toEqual(['1쪽']);
        expect(result.current.isPlaceholderData).toBe(true);

        resolveNext(['2쪽']);
        await waitFor(() => expect(result.current.data).toEqual(['2쪽']));
    });

    it('다음 페이지를 받지 못하면 이전 목록을 새 페이지처럼 보이지 않는다', async () => {
        const { wrapper } = setup();
        const { result, rerender } = renderHook(
            ({ page }) =>
                useQuery({
                    ...queryPresets.paged,
                    queryKey: ['list', page],
                    queryFn: () =>
                        page === 1 ? Promise.resolve(['1쪽']) : Promise.reject(new Error('실패')),
                }),
            { wrapper, initialProps: { page: 1 } },
        );
        await waitFor(() => expect(result.current.data).toEqual(['1쪽']));

        rerender({ page: 2 });
        await waitFor(() => expect(result.current.isError).toBe(true));
        expect(result.current.data).toBeUndefined();
    });

    it('같은 목록을 다시 받다 실패하면 받아 둔 목록을 유지한다', async () => {
        const { wrapper } = setup();
        let fail = false;
        const { result } = renderHook(
            () =>
                useQuery({
                    ...queryPresets.paged,
                    queryKey: ['list', 1],
                    queryFn: () =>
                        fail ? Promise.reject(new Error('실패')) : Promise.resolve(['1쪽']),
                }),
            { wrapper },
        );
        await waitFor(() => expect(result.current.data).toEqual(['1쪽']));

        fail = true;
        const refetched = await result.current.refetch();
        expect(refetched.isError).toBe(true);
        expect(refetched.data).toEqual(['1쪽']);
    });
});
