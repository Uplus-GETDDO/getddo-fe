import type { ReactNode } from 'react';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import { server } from '@mocks/server';
import { ApiError } from '@shared/api/client';

import { useAdminUser, useAdminUsers } from './admin';

const id = '00000000-0000-4000-8000-000000000001';
const user = {
    id,
    name: '관리자',
    role: 'ADMIN',
    status: 'INACTIVE',
    membership: null,
    createdAt: '2026-10-01T00:00:00Z',
    updatedAt: '2026-10-02T00:00:00Z',
};
function setup() {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return {
        wrapper: ({ children }: { children: ReactNode }) => (
            <QueryClientProvider client={client}>{children}</QueryClientProvider>
        ),
    };
}

describe('관리자 사용자 조회', () => {
    it('필터와 빈 페이지를 그대로 전달하고 전체 활성 사용자 수를 보존한다', async () => {
        const requests: URLSearchParams[] = [];
        server.use(
            http.get('*/v1/admin/users', ({ request }) => {
                const params = new URL(request.url).searchParams;
                requests.push(params);
                return HttpResponse.json({
                    success: true,
                    data: {
                        items: [],
                        page: Number(params.get('page')),
                        size: 20,
                        totalElements: 0,
                        totalUserCount: 12,
                    },
                });
            }),
        );
        const { result, rerender } = renderHook(
            ({ page }) =>
                useAdminUsers({
                    page,
                    size: 20,
                    keyword: '%_',
                    role: 'ADMIN',
                    status: 'INACTIVE',
                    membership: 'vip',
                    userId: id,
                }),
            { ...setup(), initialProps: { page: 1 } },
        );
        await waitFor(() => expect(result.current.data?.totalUserCount).toBe(12));
        expect(result.current.data?.totalElements).toBe(0);
        rerender({ page: 999 });
        await waitFor(() => expect(result.current.data?.page).toBe(999));
        expect(result.current.data?.totalUserCount).toBe(12);
        expect(Object.fromEntries(requests[0]!)).toMatchObject({
            keyword: '%_',
            role: 'ADMIN',
            status: 'INACTIVE',
            membership: 'vip',
            userId: id,
        });
    });
    it('전체 사용자 수 누락을 정상 0명으로 바꾸지 않는다', async () => {
        server.use(
            http.get('*/v1/admin/users', () =>
                HttpResponse.json({
                    success: true,
                    data: { items: [], page: 1, size: 20, totalElements: 0 },
                }),
            ),
        );
        const { result } = renderHook(() => useAdminUsers({ page: 1, size: 20 }), setup());
        await waitFor(() => expect(result.current.isError).toBe(true));
        expect(result.current.data).toBeUndefined();
    });
    it('상세는 멤버십 null을 허용하고 목록 집계 필드를 요구하지 않는다', async () => {
        server.use(
            http.get('*/v1/admin/users/:id', () =>
                HttpResponse.json({ success: true, data: user }),
            ),
        );
        const { result } = renderHook(() => useAdminUser(id), setup());
        await waitFor(() => expect(result.current.data?.membership).toBeNull());
    });
    it.each([403, 404])('상세 %i 오류를 보존하고 자동 재요청하지 않는다', async (status) => {
        let calls = 0;
        server.use(
            http.get('*/v1/admin/users/:id', () => {
                calls++;
                return HttpResponse.json(
                    {
                        success: false,
                        code: status === 403 ? 'USER-009' : 'USER-010',
                        message: '조회 불가',
                        data: null,
                    },
                    { status },
                );
            }),
        );
        const { result } = renderHook(() => useAdminUser(id), setup());
        await waitFor(() => expect(result.current.error).toBeInstanceOf(ApiError));
        expect((result.current.error as ApiError).status).toBe(status);
        expect(calls).toBe(1);
    });
    it('상세 ID가 없으면 요청하지 않는다', () => {
        const { result } = renderHook(() => useAdminUser(null), setup());
        expect(result.current.fetchStatus).toBe('idle');
    });
});
