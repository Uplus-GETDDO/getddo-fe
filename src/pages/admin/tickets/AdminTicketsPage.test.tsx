import { focusManager, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { createMemoryRouter, MemoryRouter, RouterProvider } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { server } from '@mocks/server';

import { AdminTicketsPage } from './AdminTicketsPage';

function renderPage(initialEntry = '/admin/tickets') {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return render(
        <QueryClientProvider client={client}>
            <MemoryRouter initialEntries={[initialEntry]}>
                <AdminTicketsPage />
            </MemoryRouter>
        </QueryClientProvider>,
    );
}

function renderRoutedPage(initialEntries: string[], initialIndex = 0) {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const router = createMemoryRouter([{ path: '/admin/tickets', element: <AdminTicketsPage /> }], {
        initialEntries,
        initialIndex,
    });
    render(
        <QueryClientProvider client={client}>
            <RouterProvider router={router} />
        </QueryClientProvider>,
    );
    return { client, router };
}

afterEach(() => {
    vi.useRealTimers();
    focusManager.setFocused(undefined);
});

describe('AdminTicketsPage', () => {
    it('탭 없이 전체 이력 단일 화면을 보여준다', async () => {
        renderPage();
        expect(screen.getByText('응모권 지급·사용 내역을 확인합니다.')).toBeInTheDocument();
        expect(screen.queryByRole('tab')).not.toBeInTheDocument();
        expect(await screen.findByText(/총 \d+건/)).toBeInTheDocument();
    });

    it('?tab=consistency 링크는 탭 파라미터를 무시하고 전체 이력이 열린다', async () => {
        renderPage('/admin/tickets?tab=consistency');
        expect(await screen.findByLabelText('사용자 ID 필터')).toBeInTheDocument();
        expect(screen.queryByRole('tab')).not.toBeInTheDocument();
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        expect(await screen.findByText(/총 \d+건/)).toBeInTheDocument();
    });

    it('?tab=consistency&userId= 링크도 정합성 서랍 대신 사용자 필터의 전체 이력이 열린다', async () => {
        renderPage('/admin/tickets?tab=consistency&userId=vu-doyoon');
        expect(await screen.findByLabelText('사용자 ID 필터')).toHaveValue('vu-doyoon');
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        expect(await screen.findByText(/총 \d+건/)).toBeInTheDocument();
    });

    it('?tab=grants&date= 링크는 그날이 걸린 전체 이력이 열린다', async () => {
        renderPage('/admin/tickets?tab=grants&date=2026-10-02');
        expect(await screen.findByLabelText('처리일 시작일')).toHaveValue('2026-10-02');
        expect(screen.getByLabelText('처리일 종료일')).toHaveValue('2026-10-02');
        expect(await screen.findByText(/총 \d+건/)).toBeInTheDocument();
    });

    it('대시보드 링크의 ?date=&operationType= 가 전체 이력 필터로 적용된다', async () => {
        renderPage('/admin/tickets?date=2026-10-02&operationType=USE');
        expect(await screen.findByLabelText('처리일 시작일')).toHaveValue('2026-10-02');
        expect(screen.getByLabelText('처리 유형 필터')).toHaveTextContent('사용');
        expect(await screen.findByText(/총 \d+건/)).toBeInTheDocument();
    });

    it('사용자 상세 링크의 ?userId= 가 전체 이력 필터로 적용된다', async () => {
        renderPage('/admin/tickets?userId=vu-doyoon');
        expect(await screen.findByLabelText('사용자 ID 필터')).toHaveValue('vu-doyoon');
        expect(await screen.findByText(/총 \d+건/)).toBeInTheDocument();
    });

    it('같은 경로에서 URL의 사용자가 바뀌면 이전 사용자 필터가 남지 않는다', async () => {
        const { client, router } = renderRoutedPage(
            ['/admin/tickets?userId=vu-doyoon', '/admin/tickets'],
            0,
        );
        try {
            expect(await screen.findByLabelText('사용자 ID 필터')).toHaveValue('vu-doyoon');
            await act(() => router.navigate(1));
            await waitFor(() => expect(screen.getByLabelText('사용자 ID 필터')).toHaveValue(''));
        } finally {
            client.clear();
            router.dispose();
        }
    });

    it('같은 경로에서 링크 날짜·처리 유형이 바뀌면 이전 조건이 남지 않는다', async () => {
        const { client, router } = renderRoutedPage(
            ['/admin/tickets?date=2026-10-19&operationType=USE', '/admin/tickets'],
            0,
        );
        try {
            expect(await screen.findByLabelText('처리일 시작일')).toHaveValue('2026-10-19');
            expect(screen.getByLabelText('처리 유형 필터')).toHaveTextContent('사용');
            await act(() => router.navigate(1));
            await waitFor(() => expect(screen.getByLabelText('처리일 시작일')).toHaveValue(''));
            expect(screen.getByLabelText('처리 유형 필터')).toHaveTextContent('전체 처리');
        } finally {
            client.clear();
            router.dispose();
        }
    });

    it('검색 조건에 맞는 결과가 없으면 빈 목록을 안내한다', async () => {
        const user = userEvent.setup();
        renderPage();
        await user.type(await screen.findByLabelText('사용자 ID 필터'), '없는사용자');
        await user.click(screen.getByRole('button', { name: '검색' }));
        expect(await screen.findByText('해당하는 이력이 없습니다.')).toBeInTheDocument();
    });

    it('30초 폴링으로 목록을 갱신해도 입력 중인 필터가 지워지지 않는다', async () => {
        let calls = 0;
        server.use(
            http.get('*/v1/admin/ticket-histories', () => {
                calls += 1;
                return HttpResponse.json({
                    success: true,
                    code: 'SUCCESS',
                    message: '성공했습니다.',
                    data: { items: [], page: 1, size: 20, totalElements: 0 },
                });
            }),
        );
        renderPage();
        const input = await screen.findByLabelText('사용자 ID 필터');
        // 검색을 누르지 않은 draft 입력 — 폴링 refetch는 적용 조건(applied)만 다시 받는다
        fireEvent.change(input, { target: { value: 'vu-doyoon' } });
        await waitFor(() => expect(calls).toBe(1));

        vi.useFakeTimers();
        focusManager.setFocused(true);
        try {
            await act(async () => {
                await vi.advanceTimersByTimeAsync(30_000);
            });
            expect(calls).toBeGreaterThan(1);
            expect(input).toHaveValue('vu-doyoon');
        } finally {
            vi.useRealTimers();
        }
    });
});
