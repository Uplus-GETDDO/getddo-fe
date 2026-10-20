import type { ReactNode } from 'react';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, renderHook, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { apiClient } from '@shared/api/client';

import { MyEntryRefreshStatus } from '../ui/MyEntryRefreshStatus';
import { useMyEntryRows } from './useMyEntryRows';

vi.mock('@entities/entry', () => ({
    useMyEntries: () => ({
        data: Array.from({ length: 25 }, (_, index) => ({
            id: `entry-${index}`,
            eventId: `event-${index}`,
            eventTitle: `이벤트 ${index}`,
            status: 'ACCEPTED',
            requestedAt: new Date(2026, 0, 25 - index).toISOString(),
        })),
        isPending: false,
        isError: false,
        isFetching: false,
        refetch: vi.fn(),
    }),
}));
vi.mock('@entities/event', () => ({ useEventList: () => ({ data: [] }) }));

async function settle() {
    await act(async () => {
        await vi.advanceTimersByTimeAsync(10);
    });
}

afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
});

describe('내 응모 표시 범위', () => {
    it('최초 25건 집계 후 20행만 두 주기 조회하고 표시 범위 교체를 반영한다', async () => {
        vi.useFakeTimers();
        const counts = new Map<string, number>();
        vi.spyOn(apiClient, 'get').mockImplementation(async (url) => {
            await Promise.resolve();
            const eventId = url.split('/')[3]!;
            counts.set(eventId, (counts.get(eventId) ?? 0) + 1);
            return {
                data: {
                    success: true,
                    data: {
                        eventId,
                        result: 'PENDING',
                        isPublished: false,
                        prize: null,
                        revision: null,
                        serverTime: '2026-01-01T00:00:00Z',
                    },
                },
            };
        });
        const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
        const wrapper = ({ children }: { children: ReactNode }) => (
            <QueryClientProvider client={client}>{children}</QueryClientProvider>
        );
        const { result, rerender } = renderHook(
            ({ start, count }) =>
                useMyEntryRows({
                    selectVisibleRows: (rows) => rows.slice(start, start + count),
                }),
            { wrapper, initialProps: { start: 0, count: 20 } },
        );
        await settle();
        expect(result.current.rows).toHaveLength(25);
        expect([...counts.values()].reduce((a, b) => a + b, 0)).toBe(25);
        await act(async () => {
            await vi.advanceTimersByTimeAsync(60_000);
        });
        expect(counts.get('event-0')).toBe(3);
        expect(counts.get('event-24')).toBe(1);
        rerender({ start: 21, count: 4 });
        await settle();
        const previous = counts.get('event-0');
        await act(async () => {
            await vi.advanceTimersByTimeAsync(60_000);
        });
        expect(counts.get('event-0')).toBe(previous);
        expect(counts.get('event-24')).toBe(3);
        client.clear();
    });
    it('백그라운드 실패에도 결과와 성공 시각을 보존하고 수동 조회로 복구한다', async () => {
        vi.useFakeTimers();
        let fail = false;
        let recovered = false;
        vi.spyOn(apiClient, 'get').mockImplementation(async (url) => {
            await Promise.resolve();
            if (fail) throw new Error('network');
            return {
                data: {
                    success: true,
                    data: {
                        eventId: url.split('/')[3],
                        result: recovered ? 'LOST' : 'PENDING',
                        isPublished: recovered,
                        prize: null,
                        revision: recovered ? 1 : null,
                        serverTime: '2026-01-01T00:00:00Z',
                    },
                },
            };
        });
        const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
        const wrapper = ({ children }: { children: ReactNode }) => (
            <QueryClientProvider client={client}>{children}</QueryClientProvider>
        );
        const { result } = renderHook(
            () => useMyEntryRows({ selectVisibleRows: (rows) => rows.slice(0, 4) }),
            { wrapper },
        );
        await settle();
        expect(result.current.isResultPending).toBe(false);
        const successTime = result.current.oldestResultUpdatedAt;
        expect(result.current.rows[0]?.result).toBe('PENDING');
        fail = true;
        await act(async () => {
            await vi.advanceTimersByTimeAsync(32_000);
        });
        expect(result.current.isResultRefreshError).toBe(true);
        expect(result.current.isResultInitialError).toBe(false);
        expect(result.current.rows[0]?.result).toBe('PENDING');
        expect(result.current.oldestResultUpdatedAt).toBe(successTime);
        fail = false;
        recovered = true;
        await act(async () => {
            await result.current.refetch();
        });
        await settle();
        expect(result.current.rows.every((row) => row.result === 'LOST')).toBe(true);
        expect(result.current.isResultError).toBe(false);
        expect(result.current.oldestResultUpdatedAt).toBeGreaterThan(successTime!);
        client.clear();
    });
    it('결과 필터가 바뀌면 새 필터의 표시 행만 주기 조회한다', async () => {
        vi.useFakeTimers();
        const counts = new Map<string, number>();
        vi.spyOn(apiClient, 'get').mockImplementation(async (url) => {
            await Promise.resolve();
            const eventId = url.split('/')[3]!;
            counts.set(eventId, (counts.get(eventId) ?? 0) + 1);
            const index = Number(eventId.split('-')[1]);
            return {
                data: {
                    success: true,
                    data: {
                        eventId,
                        result: index % 2 === 0 ? 'PENDING' : 'NOT_ENTERED',
                        isPublished: false,
                        prize: null,
                        revision: null,
                        serverTime: '2026-01-01T00:00:00Z',
                    },
                },
            };
        });
        const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
        const wrapper = ({ children }: { children: ReactNode }) => (
            <QueryClientProvider client={client}>{children}</QueryClientProvider>
        );
        const { result, rerender } = renderHook(
            ({ status }) =>
                useMyEntryRows({
                    selectVisibleRows: (rows) =>
                        rows.filter((row) => row.result === status).slice(0, 4),
                }),
            { wrapper, initialProps: { status: 'PENDING' } },
        );
        await settle();
        expect(result.current.rows[0]?.result).toBe('PENDING');
        await act(async () => {
            await vi.advanceTimersByTimeAsync(60_000);
        });
        expect(counts.get('event-0')).toBe(3);
        expect(counts.get('event-1')).toBe(1);
        rerender({ status: 'NOT_ENTERED' });
        await settle();
        await act(async () => {
            await vi.advanceTimersByTimeAsync(60_000);
        });
        expect(counts.get('event-0')).toBe(3);
        expect(counts.get('event-1')).toBe(3);
        client.clear();
    });
    it('화면은 갱신 실패 시 이전 결과와 성공 시각을 유지하고 재조회 버튼으로 복구한다', async () => {
        vi.useFakeTimers();
        let fail = false;
        let recovered = false;
        vi.spyOn(apiClient, 'get').mockImplementation(async (url) => {
            await Promise.resolve();
            if (fail) throw new Error('network');
            return {
                data: {
                    success: true,
                    data: {
                        eventId: url.split('/')[3],
                        result: recovered ? 'LOST' : 'PENDING',
                        isPublished: recovered,
                        prize: null,
                        revision: recovered ? 1 : null,
                        serverTime: '2026-01-01T00:00:00Z',
                    },
                },
            };
        });
        const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
        function Screen() {
            const query = useMyEntryRows({ selectVisibleRows: (rows) => rows.slice(0, 4) });
            return (
                <>
                    <MyEntryRefreshStatus query={query} />
                    <output>{query.rows[0]?.result}</output>
                </>
            );
        }
        render(
            <QueryClientProvider client={client}>
                <Screen />
            </QueryClientProvider>,
        );
        await settle();
        expect(screen.getByRole('button', { name: '전체 응모 다시 조회' })).toBeEnabled();
        expect(screen.getByText('PENDING')).toBeInTheDocument();
        const successTime = screen.getByText(/가장 오래된 성공 시각/).textContent;
        fail = true;
        await act(async () => {
            await vi.advanceTimersByTimeAsync(32_000);
        });
        expect(screen.getByText('PENDING')).toBeInTheDocument();
        expect(screen.getByText(/일부 응모 갱신에 실패/)).toBeInTheDocument();
        expect(screen.getByText(/가장 오래된 성공 시각/).textContent).toBe(successTime);
        fail = false;
        recovered = true;
        fireEvent.click(screen.getByRole('button', { name: '전체 응모 다시 조회' }));
        await settle();
        expect(screen.getByText('LOST')).toBeInTheDocument();
        client.clear();
    });
});
