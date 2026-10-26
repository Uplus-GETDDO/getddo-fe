import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ApiError, apiClient } from '@shared/api/client';

import { server } from '../../../mocks/server';
import { LiveEntryRefresh, LiveEntryStatus } from './LiveEntryStatus';

afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
});

describe('실시간 응모 현황 갱신', () => {
    it('최초 429 지연 재시도 중에는 갱신 실패로 표시하고 90초 뒤 복구한다', async () => {
        vi.useFakeTimers();
        const request = vi
            .spyOn(apiClient, 'get')
            .mockRejectedValueOnce(new ApiError('COMMON-006', '대기', 429, 90))
            .mockResolvedValue({
                data: {
                    success: true,
                    data: {
                        eventId: 'limited',
                        participantCount: 12,
                        totalSpentTicketCount: 24,
                        mySpentTicketCount: 1,
                        serverTime: '2026-10-20T00:00:00Z',
                    },
                },
            });
        const client = new QueryClient({
            defaultOptions: { queries: { refetchOnWindowFocus: false } },
        });
        const rendered = render(
            <QueryClientProvider client={client}>
                <LiveEntryStatus eventId="limited" isOpen />
                <LiveEntryRefresh eventId="limited" isOpen />
            </QueryClientProvider>,
        );
        await act(async () => {
            await vi.advanceTimersByTimeAsync(1);
        });
        expect(screen.getByText('갱신 실패 · 다시 시도')).toBeInTheDocument();
        await act(async () => {
            await vi.advanceTimersByTimeAsync(60_000);
        });
        expect(request).toHaveBeenCalledTimes(1);
        await act(async () => {
            await vi.advanceTimersByTimeAsync(30_001);
        });
        expect(screen.getByText('12명 참여 중')).toBeInTheDocument();
        expect(screen.queryByText('갱신 실패 · 다시 시도')).not.toBeInTheDocument();
        rendered.unmount();
        client.clear();
    });
    it('갱신 실패에도 이전 수치를 유지하고 갱신 표시를 눌러 복구한다', async () => {
        const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
        render(
            <QueryClientProvider client={client}>
                <LiveEntryStatus eventId="evt-001" isOpen />
                <LiveEntryRefresh eventId="evt-001" isOpen />
            </QueryClientProvider>,
        );
        await screen.findByText(/명 참여 중/);
        const previous = screen.getByText(/명 참여 중/).textContent;
        server.use(
            http.get('*/v1/events/evt-001/statistics', () =>
                HttpResponse.json({ code: 'USER-004', message: '권한 없음' }, { status: 403 }),
            ),
        );
        await act(() => client.refetchQueries({ queryKey: ['entries', 'statistics', 'evt-001'] }));
        expect(screen.getByText(previous ?? '')).toBeInTheDocument();
        expect(
            await screen.findByRole('button', { name: '갱신에 실패했어요. 다시 받기' }),
        ).toBeEnabled();
        server.resetHandlers();
        act(() => screen.getByRole('button', { name: '갱신에 실패했어요. 다시 받기' }).click());
        await waitFor(() =>
            expect(screen.queryByText('갱신 실패 · 다시 시도')).not.toBeInTheDocument(),
        );
        client.clear();
    });
});
