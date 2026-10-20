import type { ReactNode } from 'react';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import { server } from '@mocks/server';

import { useAdminDailyStats } from './queries';

function setup() {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return {
        wrapper: ({ children }: { children: ReactNode }) => (
            <QueryClientProvider client={client}>{children}</QueryClientProvider>
        ),
    };
}

describe('useAdminDailyStats (AS01)', () => {
    it('KST 날짜 범위를 그대로 보내고 모든 날의 지표를 파싱한다', async () => {
        let seen: URLSearchParams | null = null;
        server.use(
            http.get('*/v1/admin/stats/daily', ({ request }) => {
                seen = new URL(request.url).searchParams;
                return HttpResponse.json({
                    success: true,
                    data: {
                        days: [
                            {
                                date: '2026-10-19',
                                entrantCount: 3,
                                entryCount: 5,
                                activeUserCount: 4,
                                grantedTickets: { ATTENDANCE: 10, MISSION: 2, GAME: 1 },
                                usedTickets: 6,
                                blockedCount: 0,
                            },
                            {
                                date: '2026-10-20',
                                entrantCount: 0,
                                entryCount: 0,
                                activeUserCount: 0,
                                grantedTickets: { ATTENDANCE: 0, MISSION: 0, GAME: 0 },
                                usedTickets: 0,
                                blockedCount: 0,
                            },
                        ],
                        totalUserCount: 12,
                    },
                });
            }),
        );
        const { result } = renderHook(
            () => useAdminDailyStats({ from: '2026-10-19', to: '2026-10-20' }),
            setup(),
        );
        await waitFor(() => expect(result.current.data?.totalUserCount).toBe(12));
        // UTC 구간 변환 없이 KST 날짜 문자열을 그대로 보낸다
        expect(seen!.get('from')).toBe('2026-10-19');
        expect(seen!.get('to')).toBe('2026-10-20');
        expect(result.current.data?.days).toHaveLength(2);
        expect(result.current.data?.days[0]?.grantedTickets.GAME).toBe(1);
        expect(result.current.data?.days[1]?.entrantCount).toBe(0);
    });

    it('범위에 빠진 날이 오면 성공 0으로 채우지 않고 오류로 알린다', async () => {
        server.use(
            http.get('*/v1/admin/stats/daily', () =>
                HttpResponse.json({
                    success: true,
                    data: {
                        days: [
                            {
                                date: '2026-10-19',
                                entrantCount: 0,
                                entryCount: 0,
                                activeUserCount: 0,
                                grantedTickets: { ATTENDANCE: 0, MISSION: 0, GAME: 0 },
                                usedTickets: 0,
                                blockedCount: 0,
                            },
                        ],
                        totalUserCount: 12,
                    },
                }),
            ),
        );
        const { result } = renderHook(
            () => useAdminDailyStats({ from: '2026-10-19', to: '2026-10-20' }),
            setup(),
        );
        await waitFor(() => expect(result.current.isError).toBe(true));
        expect(result.current.data).toBeUndefined();
    });

    it('32일 범위는 보내지 않고 파라미터 오류를 낸다', () => {
        expect(() =>
            renderHook(() => useAdminDailyStats({ from: '2026-09-20', to: '2026-10-22' }), setup()),
        ).toThrow();
    });
});
