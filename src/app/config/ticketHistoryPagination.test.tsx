import type { ReactNode } from 'react';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useSessionStore } from '@entities/user';
import { server } from '@mocks/server';
import { MyPage } from '@pages/myPage/MyPage';
import { MyTicketsPage } from '@pages/myTickets/MyTicketsPage';
import { VirtualClockContext } from '@shared/model/virtualClock';
import { TicketWallet } from '@widgets/ticketWallet';

const now = new Date('2026-10-19T03:00:00Z');
const totals: Record<string, number> = { GRANT: 1000, REFUND: 20, USE: 300, EXPIRE: 40 };
function renderContent(content: ReactNode) {
    const client = new QueryClient({
        defaultOptions: { queries: { retry: false, staleTime: 60_000 } },
    });
    render(
        <QueryClientProvider client={client}>
            <VirtualClockContext.Provider
                value={{
                    now: () => now,
                    override: null,
                    isOverridden: false,
                    setOverride: () => {},
                }}
            >
                <MemoryRouter>{content}</MemoryRouter>
            </VirtualClockContext.Provider>
        </QueryClientProvider>,
    );
    return client;
}
function historiesHandler(requests: URL[], failCounts = false) {
    return http.get('*/v1/tickets/histories/me', ({ request }) => {
        const url = new URL(request.url);
        requests.push(url);
        const count = url.searchParams.get('size') === '1';
        if (count && failCounts) return HttpResponse.json({ success: false }, { status: 500 });
        const next = url.searchParams.has('cursor');
        const size = count ? 1 : next ? 1 : 5;
        return HttpResponse.json({
            success: true,
            data: {
                items: Array.from({ length: size }, (_, index) => ({
                    id: `history-${next ? 5 : index}`,
                    ticketId: `ticket-${next ? 5 : index}`,
                    operationType: 'GRANT',
                    grade: 'BRONZE',
                    status: 'AVAILABLE',
                    reason: '이력 미리보기',
                    expiresAt: '2026-11-01T00:00:00Z',
                    createdAt: '2026-10-19T02:00:00Z',
                })),
                nextCursor: count || next ? null : 'next',
                totalElements: count ? totals[url.searchParams.get('operationType') ?? ''] : 1000,
            },
        });
    });
}
beforeEach(() => {
    vi.stubGlobal('matchMedia', () => ({
        matches: true,
        addEventListener: () => {},
        removeEventListener: () => {},
    }));
    useSessionStore.getState().selectUser({
        id: 'history-test',
        name: '이력 테스트',
        role: 'USER',
        membership: 'excellent',
        personaLabel: null,
    });
});
afterEach(() => {
    vi.unstubAllGlobals();
    useSessionStore.getState().signOut();
});

describe('응모권 화면 실제 요청 수와 기간 전체 합계', () => {
    it('지갑은 월 네 유형을 size=1로 조회하고 전체 건수를 합산한다', async () => {
        const requests: URL[] = [];
        server.use(historiesHandler(requests));
        const client = renderContent(
            <TicketWallet now={now} action={{ to: '/my-tickets', label: '내역' }} />,
        );
        expect(await screen.findByText(/이번 달 적립 1,020 · 사용 340/)).toBeInTheDocument();
        await waitFor(() => expect(client.isFetching()).toBe(0));
        expect(requests).toHaveLength(4);
        expect(requests.every((url) => url.searchParams.get('size') === '1')).toBe(true);
        expect(
            requests.every((url) => url.searchParams.get('from') === '2026-09-30T15:00:00.000Z'),
        ).toBe(true);
    });
    it('내 응모권 최초는 목록1+월합계2이며 더보기는 한 요청만 추가한다', async () => {
        const requests: URL[] = [];
        server.use(historiesHandler(requests));
        const client = renderContent(<MyTicketsPage />);
        expect(await screen.findByText('+1,000장')).toBeInTheDocument();
        expect(await screen.findByText('−300장')).toBeInTheDocument();
        await waitFor(() => expect(client.isFetching()).toBe(0));
        expect(requests).toHaveLength(3);
        expect(requests.filter((url) => url.searchParams.get('size') === '1')).toHaveLength(2);
        fireEvent.click(screen.getByRole('button', { name: '더 보기' }));
        await waitFor(() => expect(requests).toHaveLength(4));
        expect(await screen.findByText('+6장')).toBeInTheDocument();
    });
    it('마이페이지는 최근7일 size5와 오늘GRANT size1의 두 요청만 보낸다', async () => {
        const requests: URL[] = [];
        server.use(historiesHandler(requests));
        const client = renderContent(<MyPage />);
        expect(await screen.findByText('+1,000장')).toBeInTheDocument();
        await waitFor(() => expect(client.isFetching()).toBe(0));
        expect(requests).toHaveLength(2);
        const count = requests.find((url) => url.searchParams.get('size') === '1');
        expect(count?.searchParams.get('from')).toBe('2026-10-18T15:00:00.000Z');
        const preview = requests.find((url) => url.searchParams.get('size') === '5');
        expect(preview?.searchParams.get('from')).toBe('2026-10-12T03:00:00.000Z');
        expect(screen.queryByRole('button', { name: '더 보기' })).not.toBeInTheDocument();
    });
    it('월 합계 실패를 0으로 표시하지 않고 목록을 유지한 채 독립 복구한다', async () => {
        const requests: URL[] = [];
        server.use(historiesHandler(requests, true));
        renderContent(<MyTicketsPage />);
        expect(await screen.findAllByText('조회 실패')).toHaveLength(2);
        expect(await screen.findByText('+5장')).toBeInTheDocument();
        expect(screen.queryByText('+0장')).not.toBeInTheDocument();
        server.use(historiesHandler(requests));
        fireEvent.click(screen.getByRole('button', { name: '월 합계 다시 시도' }));
        expect(await screen.findByText('+1,000장')).toBeInTheDocument();
        expect(requests).toHaveLength(5);
    });
});
