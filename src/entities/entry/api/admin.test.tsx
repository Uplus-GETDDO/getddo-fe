import type { ReactNode } from 'react';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import { server } from '@mocks/server';
import { ApiError } from '@shared/api/client';

import { useAdminEntries, useAdminParticipants } from './admin';

const id = '00000000-0000-4000-8000-000000000001';
const zero = { BRONZE: 0, SILVER: 0, GOLD: 0, PLATINUM: 0 };
const rejected = {
    id,
    userId: id,
    eventId: id,
    participantId: null,
    eventTitle: '테스트 이벤트',
    requestedTicketCount: 1,
    requestedTicketsByGrade: { ...zero, PLATINUM: 1 },
    deductedTicketCount: 0,
    deductedTicketsByGrade: zero,
    status: 'REJECTED',
    requestedAt: '2026-10-19T15:00:00Z',
    acceptedAt: null,
    rejectionCode: 'TICKET-006',
    rejectionReason: '응모권 부족',
};
function setup() {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return {
        wrapper: ({ children }: { children: ReactNode }) => (
            <QueryClientProvider client={client}>{children}</QueryClientProvider>
        ),
    };
}
describe('관리자 응모 조회', () => {
    it('거절의 null 참여자와 4등급 요청량·0장 차감을 읽고 기간 필터를 전달한다', async () => {
        let params: URLSearchParams | undefined;
        server.use(
            http.get('*/v1/admin/entries', ({ request }) => {
                params = new URL(request.url).searchParams;
                return HttpResponse.json({
                    success: true,
                    data: { items: [rejected], page: 1, size: 20, totalElements: 1 },
                });
            }),
        );
        const { result } = renderHook(
            () =>
                useAdminEntries({
                    page: 1,
                    size: 20,
                    status: 'REJECTED',
                    userId: id,
                    eventId: id,
                    from: '2026-10-19T15:00:00Z',
                    to: '2026-10-20T15:00:00Z',
                }),
            setup(),
        );
        await waitFor(() => expect(result.current.isSuccess).toBe(true));
        expect(result.current.data?.items[0]).toMatchObject({
            participantId: null,
            deductedTicketCount: 0,
            requestedTicketsByGrade: { PLATINUM: 1 },
            deductedTicketsByGrade: zero,
        });
        expect(params?.get('from')).toBe('2026-10-19T15:00:00Z');
        expect(params?.get('status')).toBe('REJECTED');
    });
    it('응모자 목록은 빈 페이지와 총 인원 수를 구분한다', async () => {
        server.use(
            http.get('*/v1/admin/events/:id/participants', () =>
                HttpResponse.json({
                    success: true,
                    data: { items: [], page: 99, size: 20, totalElements: 5 },
                }),
            ),
        );
        const { result } = renderHook(
            () => useAdminParticipants(id, { page: 99, size: 20 }),
            setup(),
        );
        await waitFor(() => expect(result.current.data?.totalElements).toBe(5));
        expect(result.current.data?.items).toEqual([]);
    });
    it.each([403, 404])('응모자 %i를 빈 목록으로 숨기지 않는다', async (status) => {
        server.use(
            http.get('*/v1/admin/events/:id/participants', () =>
                HttpResponse.json(
                    {
                        success: false,
                        code: status === 403 ? 'ENTRY-010' : 'ENTRY-004',
                        message: '조회 불가',
                        data: null,
                    },
                    { status },
                ),
            ),
        );
        const { result } = renderHook(
            () => useAdminParticipants(id, { page: 1, size: 20 }),
            setup(),
        );
        await waitFor(() => expect(result.current.error).toBeInstanceOf(ApiError));
        expect((result.current.error as ApiError).status).toBe(status);
        expect(result.current.data).toBeUndefined();
    });
    it('이벤트 미선택은 요청하지 않는다', () => {
        const { result } = renderHook(
            () => useAdminParticipants(null, { page: 1, size: 20 }),
            setup(),
        );
        expect(result.current.fetchStatus).toBe('idle');
    });
});
