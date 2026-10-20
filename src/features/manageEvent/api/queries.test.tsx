import type { ReactNode } from 'react';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';

import { BANNERS_KEY } from '@entities/banner';
import { ENTRIES_KEY } from '@entities/entry';
import { EVENTS_KEY } from '@entities/event';
import { TICKETS_KEY } from '@entities/ticket';
import { apiClient } from '@shared/api/client';

import { useEventAction } from './queries';

afterEach(() => vi.restoreAllMocks());
it('이벤트 취소 후 사용자 상태·응모·반환 응모권·홈 배너를 함께 갱신한다', async () => {
    vi.spyOn(apiClient, 'post').mockResolvedValue({
        data: {
            success: true,
            data: {
                eventId: 'event',
                previousStatus: 'OPEN',
                status: 'CANCELED',
                refundedTicketCount: 3,
                processedAt: '2026-10-20T00:00:00Z',
            },
        },
    });
    const client = new QueryClient();
    for (const key of [EVENTS_KEY, ENTRIES_KEY, TICKETS_KEY, BANNERS_KEY])
        client.setQueryData(key, { previous: true });
    const wrapper = ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
    const hook = renderHook(() => useEventAction('cancel'), { wrapper });
    await act(async () => {
        await hook.result.current.mutateAsync({ eventId: 'event', reason: '취소' });
    });
    for (const key of [EVENTS_KEY, ENTRIES_KEY, TICKETS_KEY, BANNERS_KEY])
        expect(client.getQueryState(key)?.isInvalidated).toBe(true);
    client.clear();
});
