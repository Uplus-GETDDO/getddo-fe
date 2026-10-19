import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { Event } from '@entities/event';

import { server } from '../../../mocks/server';
import { ClosedRaffleList } from './ClosedRaffleList';

const now = new Date('2026-10-20T00:00:00Z');
const events: Event[] = Array.from({ length: 25 }, (_, index) => ({
    id: `closed-${index}`,
    title: `마감 래플 ${index}`,
    description: '',
    bannerImageUrl: null,
    startsAt: '2026-10-01T00:00:00Z',
    endsAt: '2026-10-19T00:00:00Z',
    status: 'closed',
    eventType: 'TICKET',
    weightingEnabled: false,
    membershipRule: 'excellent',
    myEntered: false,
    requiredTickets: 1,
}));

afterEach(() => vi.useRealTimers());

function setup(mode: 'preview' | 'full', fail = false) {
    const ids: string[] = [];
    let failing = fail;
    server.use(
        http.get('*/v1/events/:eventId/statistics', ({ params }) => {
            const eventId = String(params.eventId);
            ids.push(eventId);
            if (failing)
                return HttpResponse.json({ code: 'ENTRY-004', message: '없음' }, { status: 404 });
            return HttpResponse.json({
                success: true,
                data: {
                    eventId,
                    participantCount: 12,
                    totalSpentTicketCount: 24,
                    mySpentTicketCount: 1,
                    serverTime: now.toISOString(),
                },
            });
        }),
    );
    const client = new QueryClient({
        defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } },
    });
    const view = (rows: Event[], nextMode = mode) => (
        <QueryClientProvider client={client}>
            <MemoryRouter>
                <ClosedRaffleList events={rows} now={now} mode={nextMode} />
            </MemoryRouter>
        </QueryClientProvider>
    );
    const rendered = render(view(events));
    return {
        ...rendered,
        client,
        ids,
        view,
        recover: () => {
            failing = false;
        },
    };
}

describe('마감 래플 표시 범위', () => {
    it.each([
        ['preview', 3],
        ['full', 10],
    ] as const)(
        '%s는 표시 %i행만 읽고 두 주기 뒤에도 추가 요청하지 않는다',
        async (mode, count) => {
            const test = setup(mode);
            await waitFor(() => expect(screen.getAllByText(/12명 참여/)).toHaveLength(count));
            expect(test.ids).toHaveLength(count);
            vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
            await act(async () => {
                await vi.advanceTimersByTimeAsync(60_000);
            });
            expect(test.ids).toHaveLength(count);
            test.unmount();
            test.client.clear();
        },
    );

    it('더보기는 새 10행만 읽고 목록 교체 후 예전 행을 다시 읽지 않는다', async () => {
        const test = setup('full');
        await waitFor(() => expect(screen.getAllByText(/12명 참여/)).toHaveLength(10));
        fireEvent.click(screen.getByRole('button', { name: '더 보기' }));
        await waitFor(() => expect(screen.getAllByText(/12명 참여/)).toHaveLength(20));
        expect(test.ids).toHaveLength(20);
        test.rerender(test.view(events.slice(20)));
        await waitFor(() => expect(screen.getAllByText(/12명 참여/)).toHaveLength(5));
        expect(test.ids.slice(20)).toEqual(events.slice(20).map((event) => event.id));
        test.unmount();
        test.client.clear();
    });

    it('최초 실패를 안내하고 행 링크 밖의 재시도로 정상 복구한다', async () => {
        const test = setup('preview', true);
        await waitFor(() =>
            expect(screen.getAllByRole('button', { name: /현황 다시 조회/ })).toHaveLength(3),
        );
        expect(test.ids).toHaveLength(3);
        const button = screen.getAllByRole('button', { name: /현황 다시 조회/ })[0]!;
        expect(button.closest('a')).toBeNull();
        expect(within(button.closest('li')!).getByRole('status')).toHaveTextContent('불러오지 못');
        test.recover();
        fireEvent.click(button);
        await waitFor(() => expect(screen.getByText(/12명 참여/)).toBeInTheDocument());
        expect(test.ids).toHaveLength(4);
        test.unmount();
        test.client.clear();
    });
});
