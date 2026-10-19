import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import { server } from '@mocks/server';
import { VirtualClockContext } from '@shared/model/virtualClock';

import { TicketHistoryCard } from './TicketHistoryCard';

const now = new Date('2026-10-19T03:00:00Z');
describe('내 응모권 페이지 경계 그룹', () => {
    it('여섯 번째 이력을 로드하면 같은 응모의 수량이 5장에서 6장으로 갱신된다', async () => {
        let requests = 0;
        server.use(
            http.get('*/v1/tickets/histories/me', ({ request }) => {
                requests += 1;
                const next = new URL(request.url).searchParams.has('cursor');
                return HttpResponse.json({
                    success: true,
                    data: {
                        items: Array.from({ length: next ? 1 : 5 }, (_, index) => ({
                            id: `history-${next ? 5 : index}`,
                            ticketId: `ticket-${next ? 5 : index}`,
                            operationType: 'USE',
                            grade: 'BRONZE',
                            status: 'SPENT',
                            reason: '같은 응모',
                            eventEntryId: 'entry-1',
                            expiresAt: '2026-11-01T00:00:00Z',
                            createdAt: '2026-10-19T02:00:00Z',
                        })),
                        nextCursor: next ? null : 'next',
                        totalElements: 6,
                    },
                });
            }),
        );
        const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
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
                    <TicketHistoryCard now={now} />
                </VirtualClockContext.Provider>
            </QueryClientProvider>,
        );
        expect(await screen.findByText('−5장')).toBeInTheDocument();
        expect(requests).toBe(1);
        fireEvent.click(screen.getByRole('button', { name: '더 보기' }));
        expect(await screen.findByText('−6장')).toBeInTheDocument();
        expect(requests).toBe(2);
        expect(screen.getByText(/불러온 이력 기준 수량/)).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: '받은' }));
        await waitFor(() => expect(requests).toBe(3));
    });
});
