import { QueryClient, QueryClientProvider, focusManager } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { apiClient } from '@shared/api/client';
import { useMyEntryRows } from '@widgets/myEntryRows';

const serverTime = '2026-10-20T00:00:00Z';
const eventItems = Array.from({ length: 21 }, (_, index) => ({
    id: `event-${index}`,
    title: `이벤트 ${index}`,
    imageUrl: null,
    eventType: 'TICKET',
    weightingEnabled: false,
    membershipRule: 'excellent',
    status: 'CLOSED',
    startsAt: '2026-10-01T00:00:00Z',
    endsAt: '2026-10-19T00:00:00Z',
    serverTime,
}));
const entryItems = Array.from({ length: 51 }, (_, index) => ({
    id: `entry-${index}`,
    eventId: index === 50 ? 'rejected' : `event-${index % 25}`,
    eventTitle: `이벤트 ${index % 25}`,
    status: index === 50 ? 'REJECTED' : 'ACCEPTED',
    requestedAt: new Date(Date.parse(serverTime) - index * 1000).toISOString(),
    acceptedAt: index === 50 ? null : serverTime,
    requestedTicketCount: 1,
    deductedTicketCount: index === 50 ? 0 : 1,
    requestedTicketsByGrade: { BRONZE: 1, SILVER: 0, GOLD: 0, PLATINUM: 0 },
    deductedTicketsByGrade: { BRONZE: index === 50 ? 0 : 1, SILVER: 0, GOLD: 0, PLATINUM: 0 },
    rejectionCode: index === 50 ? 'ENTRY-005' : null,
    rejectionReason: index === 50 ? '응모 마감' : null,
}));

afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
    focusManager.setFocused(undefined);
});

describe('응모 행 조회 통합 요청 카운터', () => {
    it('E01/E06 전체 페이지와 집계 최초 조회를 유지하고 중복·거절을 제외한 표시20개만 3주기 갱신한다', async () => {
        vi.useFakeTimers();
        focusManager.setFocused(true);
        const pages = { events: [] as number[], entries: [] as number[] };
        const results: string[] = [];
        vi.spyOn(apiClient, 'get').mockImplementation(async (path, config) => {
            await Promise.resolve();
            const page = Number((config?.params as { page?: number } | undefined)?.page ?? 1);
            if (path === '/v1/events') {
                pages.events.push(page);
                return {
                    data: {
                        success: true,
                        data: {
                            items: eventItems.slice((page - 1) * 20, page * 20),
                            page,
                            size: 20,
                            totalElements: 21,
                        },
                    },
                };
            }
            if (path === '/v1/users/me/entries') {
                pages.entries.push(page);
                return {
                    data: {
                        success: true,
                        data: {
                            items: entryItems.slice((page - 1) * 50, page * 50),
                            page,
                            size: 50,
                            totalElements: 51,
                        },
                    },
                };
            }
            const eventId = String(path).split('/')[3]!;
            results.push(eventId);
            return {
                data: {
                    success: true,
                    data: {
                        eventId,
                        result: 'PENDING',
                        isPublished: false,
                        prize: null,
                        revision: null,
                        serverTime,
                    },
                },
            };
        });
        const client = new QueryClient({
            defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } },
        });
        const rendered = renderHook(
            () => useMyEntryRows({ selectVisibleGroups: (groups) => groups.slice(0, 20) }),
            {
                wrapper: ({ children }) => (
                    <QueryClientProvider client={client}>{children}</QueryClientProvider>
                ),
            },
        );
        await act(async () => {
            await vi.advanceTimersByTimeAsync(10);
        });
        expect(pages.entries).toEqual([1, 2]);
        expect(pages.events).toEqual([1, 2]);
        expect(rendered.result.current.rows).toHaveLength(51);
        expect(results).toHaveLength(25);
        expect(new Set(results).size).toBe(25);
        expect(results).not.toContain('rejected');
        for (const total of [45, 65, 85]) {
            await act(async () => {
                await vi.advanceTimersByTimeAsync(30_000);
            });
            expect(results).toHaveLength(total);
        }
        expect(results.filter((id) => id === 'event-24')).toHaveLength(1);
        expect(pages.entries).toEqual([1, 2]);
        expect(pages.events).toEqual([1, 2, 1, 2, 1, 2, 1, 2]);
        rendered.unmount();
        client.clear();
    });
});
