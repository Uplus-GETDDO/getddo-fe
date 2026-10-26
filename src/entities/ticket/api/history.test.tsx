import type { ReactNode } from 'react';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { delay, http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import type { TicketHistory, TicketOperationType } from '../model/history';

import { server } from '../../../mocks/server';
import { useTicketHistories, useTicketHistoryCounts } from './history';
import { TICKET_HISTORIES_API_PATH, TICKETS_KEY } from './queries';

function setup() {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const wrapper = ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
    return { client, wrapper };
}

function history(index: number, operationType: TicketOperationType = 'GRANT'): TicketHistory {
    return {
        id: String(index).padStart(6, '0'),
        ticketId: `ticket-${index}`,
        operationType,
        grade: 'BRONZE',
        status: 'AVAILABLE',
        reason: '테스트 적립',
        expiresAt: '2026-12-31T00:00:00Z',
        createdAt: new Date(Date.UTC(2026, 9, 19, 0, 0, index)).toISOString(),
    };
}

function page(items: TicketHistory[], nextCursor: string | null, totalElements = items.length) {
    return HttpResponse.json({ success: true, data: { items, nextCursor, totalElements } });
}

describe('응모권 이력 페이지 요청', () => {
    it.each([0, 5, 6, 1000])('%i건도 최초 진입은 size=5 한 번만 요청한다', async (total) => {
        const requests: URL[] = [];
        server.use(
            http.get(`*${TICKET_HISTORIES_API_PATH}`, ({ request }) => {
                const url = new URL(request.url);
                requests.push(url);
                const start = Number(url.searchParams.get('cursor') ?? 0);
                const size = Number(url.searchParams.get('size'));
                const end = Math.min(start + size, total);
                return page(
                    Array.from({ length: end - start }, (_, i) => history(total - start - i)),
                    end < total ? String(end) : null,
                    total,
                );
            }),
        );
        const { wrapper } = setup();
        const { result } = renderHook(() => useTicketHistories(), { wrapper });
        await waitFor(() => expect(result.current.isSuccess).toBe(true));
        expect(requests).toHaveLength(1);
        expect(requests[0]?.searchParams.get('size')).toBe('5');
        expect(result.current.items).toHaveLength(Math.min(total, 5));
        expect(result.current.hasNextPage).toBe(total > 5);
        if (total > 5) {
            await act(async () => {
                await result.current.fetchNextPage({ cancelRefetch: false });
            });
            await waitFor(() => expect(result.current.items).toHaveLength(Math.min(total, 10)));
            expect(requests).toHaveLength(2);
            expect(requests[1]?.searchParams.get('cursor')).toBe('5');
            expect(result.current.hasNextPage).toBe(total > 10);
        }
    });

    it('다음 페이지 실패 시 기존 목록을 유지하고 실패한 커서만 재시도한다', async () => {
        const cursors: (string | null)[] = [];
        let fail = true;
        server.use(
            http.get(`*${TICKET_HISTORIES_API_PATH}`, ({ request }) => {
                const cursor = new URL(request.url).searchParams.get('cursor');
                cursors.push(cursor);
                if (!cursor) return page([history(6), history(5)], 'next', 6);
                if (fail) return new HttpResponse(null, { status: 503 });
                return page([history(5), history(4)], null, 6);
            }),
        );
        const { wrapper } = setup();
        const { result } = renderHook(() => useTicketHistories(), { wrapper });
        await waitFor(() => expect(result.current.isSuccess).toBe(true));
        await act(async () => {
            await result.current.fetchNextPage();
        });
        await waitFor(() => expect(result.current.isFetchNextPageError).toBe(true));
        expect(result.current.items.map((item) => item.id)).toEqual(['000006', '000005']);
        fail = false;
        await act(async () => {
            await result.current.fetchNextPage();
        });
        await waitFor(() =>
            expect(result.current.items.map((item) => item.id)).toEqual([
                '000006',
                '000005',
                '000004',
            ]),
        );
        expect(cursors).toEqual([null, 'next', 'next']);
    });

    it.each([
        ['A', 'A'],
        ['A', 'B', 'A'],
    ])('반복 커서 %j를 더 요청하지 않는다', async (...cursors) => {
        let requests = 0;
        server.use(
            http.get(`*${TICKET_HISTORIES_API_PATH}`, () => {
                const index = requests++;
                return page([history(10 - index)], cursors[index] ?? null, 100);
            }),
        );
        const { wrapper } = setup();
        const { result } = renderHook(() => useTicketHistories(), { wrapper });
        await waitFor(() => expect(result.current.isSuccess).toBe(true));
        for (let index = 1; index < cursors.length; index++) {
            await act(async () => {
                await result.current.fetchNextPage();
            });
        }
        await waitFor(() => expect(result.current.cursorError).toBe(true));
        expect(result.current.hasNextPage).toBe(false);
        expect(requests).toBe(cursors.length);
    });

    it('빈 페이지에 다음 커서가 있으면 무한 순회를 차단한다', async () => {
        let requests = 0;
        server.use(
            http.get(`*${TICKET_HISTORIES_API_PATH}`, () => {
                requests++;
                return page([], 'invalid', 100);
            }),
        );
        const { wrapper } = setup();
        const { result } = renderHook(() => useTicketHistories(), { wrapper });
        await waitFor(() => expect(result.current.isSuccess).toBe(true));
        await waitFor(() => expect(result.current.cursorError).toBe(true));
        expect(result.current.hasNextPage).toBe(false);
        expect(requests).toBe(1);
    });

    it('더보기 연타는 같은 페이지 요청 하나만 수행한다', async () => {
        let requests = 0;
        server.use(
            http.get(`*${TICKET_HISTORIES_API_PATH}`, async ({ request }) => {
                requests++;
                if (!new URL(request.url).searchParams.has('cursor'))
                    return page([history(6)], 'next', 6);
                await delay(30);
                return page([history(5)], null, 6);
            }),
        );
        const { wrapper } = setup();
        const { result } = renderHook(() => useTicketHistories(), { wrapper });
        await waitFor(() => expect(result.current.isSuccess).toBe(true));
        await act(async () => {
            await Promise.all([
                result.current.fetchNextPage({ cancelRefetch: false }),
                result.current.fetchNextPage({ cancelRefetch: false }),
            ]);
        });
        expect(requests).toBe(2);
        await waitFor(() => expect(result.current.items).toHaveLength(2));
    });

    it('필터 지연 응답은 새 필터 캐시를 오염시키지 않고 tickets 무효화에 반응한다', async () => {
        const requests: string[] = [];
        server.use(
            http.get(`*${TICKET_HISTORIES_API_PATH}`, async ({ request }) => {
                const type = new URL(request.url).searchParams.get(
                    'operationType',
                ) as TicketOperationType;
                requests.push(type);
                if (type === 'GRANT') await delay(40);
                return page([history(type === 'GRANT' ? 2 : 1, type)], null);
            }),
        );
        const { client, wrapper } = setup();
        const { result, rerender } = renderHook(
            ({ type }: { type: TicketOperationType }) =>
                useTicketHistories({ operationType: type, from: '2026-10-01', to: '2026-11-01' }),
            { wrapper, initialProps: { type: 'GRANT' as TicketOperationType } },
        );
        await waitFor(() => expect(requests).toContain('GRANT'));
        rerender({ type: 'USE' });
        await waitFor(() => expect(result.current.items[0]?.operationType).toBe('USE'));
        await act(async () => {
            await delay(60);
        });
        expect(result.current.items[0]?.operationType).toBe('USE');
        expect(
            client.getQueryCache().findAll({ queryKey: [...TICKETS_KEY, 'histories'] }),
        ).toHaveLength(2);
        await act(async () => {
            await client.invalidateQueries({ queryKey: TICKETS_KEY });
        });
        expect(requests.filter((type) => type === 'USE')).toHaveLength(2);
    });

    it('월 합계는 size=1 응답의 totalElements를 사용한다', async () => {
        const requests: URL[] = [];
        server.use(
            http.get(`*${TICKET_HISTORIES_API_PATH}`, ({ request }) => {
                const url = new URL(request.url);
                requests.push(url);
                return page(
                    [history(1)],
                    'unused',
                    url.searchParams.get('operationType') === 'GRANT' ? 1000 : 600,
                );
            }),
        );
        const { wrapper } = setup();
        const { result } = renderHook(
            () =>
                useTicketHistoryCounts(
                    ['GRANT', 'USE'].map((operationType) => ({
                        operationType: operationType as TicketOperationType,
                        from: '2026-10-01',
                        to: '2026-11-01',
                    })),
                ),
            { wrapper },
        );
        await waitFor(() => expect(result.current.isPending).toBe(false));
        expect(result.current.counts).toEqual([1000, 600]);
        expect(requests).toHaveLength(2);
        expect(requests.every((url) => url.searchParams.get('size') === '1')).toBe(true);
        expect(requests.every((url) => url.searchParams.get('from') === '2026-10-01')).toBe(true);
        expect(requests.every((url) => url.searchParams.get('to') === '2026-11-01')).toBe(true);
    });

    it('합계 요청 실패는 0으로 바꾸지 않고 재시도로 복구한다', async () => {
        let fail = true;
        server.use(
            http.get(`*${TICKET_HISTORIES_API_PATH}`, () =>
                fail ? new HttpResponse(null, { status: 503 }) : page([history(1)], null, 1000),
            ),
        );
        const { wrapper } = setup();
        const { result } = renderHook(
            () =>
                useTicketHistoryCounts([
                    { operationType: 'GRANT', from: '2026-10-01', to: '2026-11-01' },
                ]),
            { wrapper },
        );
        await waitFor(() => expect(result.current.isError).toBe(true));
        expect(result.current.counts).toEqual([undefined]);
        fail = false;
        act(() => {
            result.current.refetch();
        });
        await waitFor(() => expect(result.current.counts).toEqual([1000]));
        expect(result.current.isError).toBe(false);
    });

    it('만료·반환 두 스트림을 버퍼로 병합하고 더보기마다 최대 두 번만 요청한다', async () => {
        const requests: string[] = [];
        server.use(
            http.get(`*${TICKET_HISTORIES_API_PATH}`, ({ request }) => {
                const url = new URL(request.url);
                const type = url.searchParams.get('operationType') as TicketOperationType;
                requests.push(type);
                const offset = Number(url.searchParams.get('cursor') ?? 0);
                const source = type === 'EXPIRE' ? [12, 10, 8, 6, 4, 2] : [11, 9, 7, 5, 3, 1];
                const end = Math.min(offset + 5, source.length);
                return page(
                    source.slice(offset, end).map((id) => history(id, type)),
                    end < source.length ? String(end) : null,
                    source.length,
                );
            }),
        );
        const { wrapper } = setup();
        const { result } = renderHook(
            () => useTicketHistories({ operationTypes: ['EXPIRE', 'REFUND'] }),
            { wrapper },
        );
        await waitFor(() => expect(result.current.isSuccess).toBe(true));
        await waitFor(() =>
            expect(result.current.items.map((item) => Number(item.id))).toEqual([12, 11, 10, 9, 8]),
        );
        expect(requests).toHaveLength(2);
        let previousRequests = requests.length;
        await act(async () => {
            await result.current.fetchNextPage();
        });
        await waitFor(() =>
            expect(result.current.items.map((item) => Number(item.id))).toEqual([
                12, 11, 10, 9, 8, 7, 6, 5, 4, 3,
            ]),
        );
        expect(requests.length - previousRequests).toBeLessThanOrEqual(2);
        previousRequests = requests.length;
        await act(async () => {
            await result.current.fetchNextPage();
        });
        await waitFor(() =>
            expect(result.current.items.map((item) => Number(item.id))).toEqual([
                12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1,
            ]),
        );
        expect(requests.length - previousRequests).toBeLessThanOrEqual(2);
        expect(result.current.hasNextPage).toBe(false);
    });

    it('동일 시각은 id 내림차순으로 병합한다', async () => {
        server.use(
            http.get(`*${TICKET_HISTORIES_API_PATH}`, ({ request }) => {
                const type = new URL(request.url).searchParams.get(
                    'operationType',
                ) as TicketOperationType;
                const item = history(type === 'EXPIRE' ? 2 : 3, type);
                return page([{ ...item, createdAt: '2026-10-19T00:00:00Z' }], null);
            }),
        );
        const { wrapper } = setup();
        const { result } = renderHook(
            () => useTicketHistories({ operationTypes: ['EXPIRE', 'REFUND'] }),
            { wrapper },
        );
        await waitFor(() => expect(result.current.isSuccess).toBe(true));
        await waitFor(() =>
            expect(result.current.items.map((item) => Number(item.id))).toEqual([3, 2]),
        );
    });

    it.each([
        ['2026-10-19T00:00:00Z', '2026-10-19T00:00:00.001Z'],
        ['2026-10-19T00:00:00.000000001Z', '2026-10-19T00:00:00.000000002Z'],
        ['2026-10-19T00:00:00Z', '2026-10-19T00:00:00.000Z'],
    ])(
        '소수 초 표기가 다른 UTC 시각 %s도 실제 시간순으로 병합한다',
        async (expiredAt, refundedAt) => {
            server.use(
                http.get(`*${TICKET_HISTORIES_API_PATH}`, ({ request }) => {
                    const type = new URL(request.url).searchParams.get(
                        'operationType',
                    ) as TicketOperationType;
                    const item = history(type === 'EXPIRE' ? 2 : 3, type);
                    return page(
                        [
                            {
                                ...item,
                                createdAt: type === 'EXPIRE' ? expiredAt : refundedAt,
                            },
                        ],
                        null,
                    );
                }),
            );
            const { wrapper } = setup();
            const { result } = renderHook(
                () => useTicketHistories({ operationTypes: ['EXPIRE', 'REFUND'] }),
                { wrapper },
            );
            await waitFor(() => expect(result.current.isSuccess).toBe(true));
            expect(result.current.items.map((item) => item.operationType)).toEqual([
                'REFUND',
                'EXPIRE',
            ]);
        },
    );

    it('짧은 페이지의 미조회 커서가 있으면 다른 스트림을 앞질러 노출하지 않는다', async () => {
        let requests = 0;
        server.use(
            http.get(`*${TICKET_HISTORIES_API_PATH}`, ({ request }) => {
                requests++;
                const url = new URL(request.url);
                const type = url.searchParams.get('operationType') as TicketOperationType;
                if (type === 'EXPIRE')
                    return url.searchParams.has('cursor')
                        ? page([history(9, type)], null, 2)
                        : page([history(10, type)], 'next', 2);
                return page(
                    [8, 7, 6, 5, 4].map((id) => history(id, type)),
                    null,
                    5,
                );
            }),
        );
        const { wrapper } = setup();
        const { result } = renderHook(
            () => useTicketHistories({ operationTypes: ['EXPIRE', 'REFUND'] }),
            { wrapper },
        );
        await waitFor(() => expect(result.current.isSuccess).toBe(true));
        expect(result.current.items.map((item) => Number(item.id))).toEqual([10]);
        expect(requests).toBe(2);
        await act(async () => {
            await result.current.fetchNextPage();
        });
        await waitFor(() =>
            expect(result.current.items.map((item) => Number(item.id))).toEqual([
                10, 9, 8, 7, 6, 5,
            ]),
        );
        expect(requests).toBe(3);
        await act(async () => {
            await result.current.fetchNextPage();
        });
        await waitFor(() =>
            expect(result.current.items.map((item) => Number(item.id))).toEqual([
                10, 9, 8, 7, 6, 5, 4,
            ]),
        );
        expect(requests).toBe(3);
    });

    it('한 스트림이 끝나도 다른 스트림은 이어가고 부분 실패를 재시도한다', async () => {
        let fail = false;
        server.use(
            http.get(`*${TICKET_HISTORIES_API_PATH}`, ({ request }) => {
                const url = new URL(request.url);
                const type = url.searchParams.get('operationType') as TicketOperationType;
                if (type === 'EXPIRE') return page([history(20, type)], null, 1);
                if (url.searchParams.has('cursor')) {
                    if (fail) return new HttpResponse(null, { status: 503 });
                    return page([history(1, type)], null, 6);
                }
                return page(
                    [10, 9, 8, 7, 6].map((id) => history(id, type)),
                    'next',
                    6,
                );
            }),
        );
        const { wrapper } = setup();
        const { result } = renderHook(
            () => useTicketHistories({ operationTypes: ['EXPIRE', 'REFUND'] }),
            { wrapper },
        );
        await waitFor(() => expect(result.current.isSuccess).toBe(true));
        const firstIds = result.current.items.map((item) => item.id);
        expect(firstIds).toHaveLength(5);
        fail = true;
        await act(async () => {
            await result.current.fetchNextPage();
        });
        await waitFor(() => expect(result.current.isFetchNextPageError).toBe(true));
        expect(result.current.items.map((item) => item.id)).toEqual(firstIds);
        fail = false;
        await act(async () => {
            await result.current.fetchNextPage();
        });
        await waitFor(() =>
            expect(result.current.items.map((item) => Number(item.id))).toEqual([
                20, 10, 9, 8, 7, 6, 1,
            ]),
        );
        expect(result.current.hasNextPage).toBe(false);
    });
});
