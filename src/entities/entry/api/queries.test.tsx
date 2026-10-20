import type { ReactNode } from 'react';

import { focusManager, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ApiError, apiClient } from '@shared/api/client';

import {
    useEntryEligibility,
    useEntryStatistics,
    useEntryStatisticsList,
    useMyEntries,
} from './queries';

afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
    focusManager.setFocused(undefined);
});

describe('내 응모 전체 합계', () => {
    it('50건 뒤 페이지까지 합산하고 수집 실패 시 마지막 전체 내역을 유지한다', async () => {
        let missing = false;
        vi.spyOn(apiClient, 'get').mockImplementation(async (_path, options) => {
            await Promise.resolve();
            const page = (options?.params as { page: number }).page;
            const grades = { BRONZE: 1, SILVER: 0, GOLD: 0, PLATINUM: 0 };
            const items = Array.from({ length: page === 1 ? 50 : missing ? 0 : 2 }, (_, n) => ({
                id: `${page}-${n}`,
                eventId: 'event',
                eventTitle: '이벤트',
                requestedTicketCount: 1,
                deductedTicketCount: 1,
                requestedTicketsByGrade: grades,
                deductedTicketsByGrade: grades,
                status: 'ACCEPTED',
                requestedAt: '2026-10-20T00:00:00Z',
                acceptedAt: '2026-10-20T00:00:00Z',
                rejectionCode: null,
                rejectionReason: null,
            }));
            return { data: { success: true, data: { page, size: 50, totalElements: 52, items } } };
        });
        const { client, wrapper } = setup();
        const hook = renderHook(() => ({ ...useMyEntries() }), { wrapper });
        await waitFor(() => expect(hook.result.current.data).toHaveLength(52));
        expect(
            hook.result.current.data?.reduce((sum, entry) => sum + entry.deductedTicketCount, 0),
        ).toBe(52);
        const updatedAt = hook.result.current.dataUpdatedAt;
        missing = true;
        await act(async () => {
            await hook.result.current.refetch();
        });
        await waitFor(() => expect(hook.result.current.isError).toBe(true));
        expect(hook.result.current.data).toHaveLength(52);
        expect(hook.result.current.dataUpdatedAt).toBe(updatedAt);
        hook.unmount();
        client.clear();
    });
});

function setup() {
    const client = new QueryClient({
        defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } },
    });
    const wrapper = ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
    return { client, wrapper };
}

describe('useEntryStatistics', () => {
    it('활성 행만 두 주기 조회하고 숨긴 탭에서는 멈춘 뒤 다시 활성화하면 재개한다', async () => {
        const counts = new Map<string, number>();
        vi.spyOn(apiClient, 'get').mockImplementation(async (path) => {
            await Promise.resolve();
            const eventId = String(path).split('/')[3]!;
            counts.set(eventId, (counts.get(eventId) ?? 0) + 1);
            return {
                data: {
                    success: true,
                    data: {
                        eventId,
                        participantCount: 12,
                        totalSpentTicketCount: 24,
                        mySpentTicketCount: 1,
                        serverTime: '2026-10-20T00:00:00Z',
                    },
                },
            };
        });
        vi.useFakeTimers();
        focusManager.setFocused(true);
        const { client, wrapper } = setup();
        const open = renderHook(
            ({ enabled }) => useEntryStatistics('poll-open', { isOpen: true, enabled }),
            { wrapper, initialProps: { enabled: true } },
        );
        const closed = renderHook(() => useEntryStatistics('poll-closed'), { wrapper });
        await act(async () => {
            await vi.advanceTimersByTimeAsync(1);
        });
        expect(open.result.current.isSuccess && closed.result.current.isSuccess).toBe(true);
        for (let cycle = 0; cycle < 2; cycle += 1) {
            await act(async () => {
                await vi.advanceTimersByTimeAsync(30_000);
            });
            expect(counts.get('poll-open')).toBe(cycle + 2);
            expect(open.result.current.isFetching).toBe(false);
        }
        expect(counts.get('poll-closed')).toBe(1);
        focusManager.setFocused(false);
        await act(async () => {
            await vi.advanceTimersByTimeAsync(60_000);
        });
        expect(counts.get('poll-open')).toBe(3);
        focusManager.setFocused(true);
        await act(async () => {
            await vi.advanceTimersByTimeAsync(30_000);
        });
        expect(counts.get('poll-open')).toBe(4);
        expect(open.result.current.isFetching).toBe(false);
        open.rerender({ enabled: false });
        await act(async () => {
            await vi.advanceTimersByTimeAsync(60_000);
        });
        expect(counts.get('poll-open')).toBe(4);
        open.unmount();
        closed.unmount();
        client.clear();
    });
    it('다중 현황 갱신 실패에도 마지막 성공값을 반환한다', async () => {
        const { client, wrapper } = setup();
        const { result } = renderHook(() => useEntryStatisticsList(['evt-001']), { wrapper });
        await waitFor(() => expect(result.current[0]?.participantCount).toBeGreaterThan(0));
        const previous = result.current[0];
        vi.spyOn(apiClient, 'get').mockRejectedValue(new ApiError('ENTRY-004', '없음', 404));
        await act(async () => {
            await client.refetchQueries({ queryKey: ['entries', 'statistics', 'evt-001'] });
        });
        await waitFor(() =>
            expect(client.getQueryState(['entries', 'statistics', 'evt-001'])?.status).toBe(
                'error',
            ),
        );
        expect(result.current[0]).toEqual(previous);
        client.clear();
    });
    it('E03 응답을 EntryStatistics로 파싱한다', async () => {
        const { wrapper } = setup();
        const { result } = renderHook(() => useEntryStatistics('evt-001'), { wrapper });

        await waitFor(() => expect(result.current.isSuccess).toBe(true));
        expect(result.current.data?.eventId).toBe('evt-001');
        expect(result.current.data?.participantCount).toBeGreaterThan(0);
    });

    it('open 이벤트만 30초 폴링하고 그 외에는 폴링하지 않는다', async () => {
        const { client, wrapper } = setup();
        const open = renderHook(() => useEntryStatistics('evt-001', { isOpen: true }), { wrapper });
        const other = renderHook(() => useEntryStatistics('evt-002'), { wrapper });

        await waitFor(() => expect(open.result.current.isSuccess).toBe(true));
        await waitFor(() => expect(other.result.current.isSuccess).toBe(true));

        const intervalOf = (id: string) => {
            const query = client.getQueryCache().find({ queryKey: ['entries', 'statistics', id] });
            const interval = query?.observers[0]?.options.refetchInterval;
            return typeof interval === 'function' && query ? interval(query) : interval;
        };
        expect(intervalOf('evt-001')).toBe(30_000);
        expect(intervalOf('evt-002')).toBe(false);
    });

    it('enabled가 false면 요청하지 않는다', () => {
        const { wrapper } = setup();
        const { result } = renderHook(() => useEntryStatistics('evt-001', { enabled: false }), {
            wrapper,
        });
        expect(result.current.fetchStatus).toBe('idle');
    });
});

describe('useEntryEligibility', () => {
    it('E07 응답을 EntryEligibility로 파싱한다', async () => {
        const { wrapper } = setup();
        const { result } = renderHook(() => useEntryEligibility('evt-002'), { wrapper });

        await waitFor(() => expect(result.current.isSuccess).toBe(true));
        // evt-002는 가중치 적용 이벤트 — 신규 사용자(익명)는 브론즈 7·실버 2·골드 1로 10장을 쓸 수 있다
        expect(result.current.data?.eventId).toBe('evt-002');
        expect(result.current.data?.canEnter).toBe(true);
        expect(result.current.data?.availableTicketBalance).toBe(10);
    });

    it('enabled가 false면 요청하지 않는다', () => {
        const { wrapper } = setup();
        const { result } = renderHook(() => useEntryEligibility('evt-002', { enabled: false }), {
            wrapper,
        });
        expect(result.current.fetchStatus).toBe('idle');
    });
});
