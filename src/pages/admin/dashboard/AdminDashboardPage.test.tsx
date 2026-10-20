import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { MemoryRouter } from 'react-router-dom';
import { expect, it } from 'vitest';

import { server } from '@mocks/server';
import { VirtualClockProvider } from '@shared/model/virtualClock';
import { recentKstDays } from '@shared/utils/date';

import { AdminDashboardPage } from './AdminDashboardPage';

it('대시보드는 공통 감사 조회 없이 기존 운영 패널을 표시한다', async () => {
    const requests: string[] = [];
    const observe = ({ request }: { request: Request }) => {
        requests.push(new URL(request.url).pathname);
    };
    server.events.on('request:start', observe);
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const view = render(
        <QueryClientProvider client={client}>
            <VirtualClockProvider>
                <MemoryRouter>
                    <AdminDashboardPage />
                </MemoryRouter>
            </VirtualClockProvider>
        </QueryClientProvider>,
    );
    try {
        expect(await screen.findByRole('heading', { name: '지금 처리할 일' })).toBeInTheDocument();
        await waitFor(() => expect(client.isFetching()).toBe(0));
        expect(requests.length).toBeGreaterThan(0);
        expect(requests.filter((path) => /\/v1\/admin\/audit-logs(?:\/|$)/.test(path))).toEqual([]);
        expect(screen.queryByText('최근 운영 기록')).not.toBeInTheDocument();
        expect(view.container.querySelector('a[href="/admin/audit"]')).toBeNull();
        expect(view.container.querySelector('a[href^="/admin/events"]')).not.toBeNull();
    } finally {
        view.unmount();
        client.clear();
        server.events.removeListener('request:start', observe);
    }
});

it('요약·추이는 AS01 한 번의 조회를 공유하고 조건별 건수 조회를 대체한다', async () => {
    const requests: string[] = [];
    const observe = ({ request }: { request: Request }) => {
        requests.push(`${new URL(request.url).pathname}?${new URL(request.url).searchParams}`);
    };
    server.events.on('request:start', observe);
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const view = render(
        <QueryClientProvider client={client}>
            <VirtualClockProvider>
                <MemoryRouter>
                    <AdminDashboardPage />
                </MemoryRouter>
            </VirtualClockProvider>
        </QueryClientProvider>,
    );
    try {
        expect(await screen.findByText('오늘 어뷰징 탐지 기록')).toBeInTheDocument();
        await waitFor(() => expect(client.isFetching()).toBe(0));

        const statsCalls = requests.filter((r) => r.startsWith('/api/v1/admin/stats/daily'));
        expect(statsCalls).toHaveLength(1);
        // KST 날짜 양끝 포함 7일 범위를 그대로 보낸다
        expect(statsCalls[0]).toMatch(/from=\d{4}-\d{2}-\d{2}&to=\d{4}-\d{2}-\d{2}/);
        // 이전 구현: 날짜×출처 지급 건수 21회·사용 건수 7회·요약용 지급 2회·차단 목업 2회
        expect(
            requests.filter(
                (r) => r.startsWith('/api/v1/admin/ticket-grants?') && r.includes('size=1'),
            ),
        ).toEqual([]);
        expect(
            requests.filter(
                (r) => r.startsWith('/api/v1/admin/ticket-histories?') && r.includes('size=1'),
            ),
        ).toEqual([]);
        expect(requests.filter((r) => r.startsWith('/api/v1/admin/abuse-cases'))).toEqual([]);
        // AS01 지표가 요약·추이에 보인다 — 탐지 기록은 차단 확정 건수로 표기하지 않는다
        expect(screen.getByText('오늘 어뷰징 탐지 기록')).toBeInTheDocument();
        expect(screen.getByText('현재 활성 일반 사용자')).toBeInTheDocument();
        expect(screen.getByText('참여율(활동 사용자 ÷ 현재 활성 일반 사용자)')).toBeInTheDocument();
    } finally {
        view.unmount();
        client.clear();
        server.events.removeListener('request:start', observe);
    }
});

it('활성 일반 사용자가 0명이면 참여율을 계산 불가로 표시한다', async () => {
    const day = (date: string) => ({
        date,
        entrantCount: 0,
        entryCount: 0,
        activeUserCount: 3,
        grantedTickets: { ATTENDANCE: 0, MISSION: 0, GAME: 0 },
        usedTickets: 0,
        blockedCount: 0,
    });
    server.use(
        http.get('*/v1/admin/stats/daily', () =>
            HttpResponse.json({
                success: true,
                data: {
                    // 페이지가 요청하는 최근 7일(KST, 오늘 포함)과 정확히 같은 범위를 반환한다
                    days: recentKstDays(new Date(), 7).map((d) => day(d.ymd)),
                    totalUserCount: 0,
                },
            }),
        ),
    );
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const view = render(
        <QueryClientProvider client={client}>
            <VirtualClockProvider>
                <MemoryRouter>
                    <AdminDashboardPage />
                </MemoryRouter>
            </VirtualClockProvider>
        </QueryClientProvider>,
    );
    try {
        // 분모가 0이면 0%나 무한대 대신 '계산 불가'로 표시한다
        expect(await screen.findByText('계산 불가')).toBeInTheDocument();
    } finally {
        view.unmount();
        client.clear();
    }
});
