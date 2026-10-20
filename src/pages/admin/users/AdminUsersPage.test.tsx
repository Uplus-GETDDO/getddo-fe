import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import { server } from '@mocks/server';

import { AdminUsersPage } from './AdminUsersPage';

function renderPage(initialEntry = '/admin/users') {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return render(
        <QueryClientProvider client={client}>
            <MemoryRouter initialEntries={[initialEntry]}>
                <AdminUsersPage />
            </MemoryRouter>
        </QueryClientProvider>,
    );
}

describe('AdminUsersPage', () => {
    it('사용자 목록과 필터와 무관한 전체 활성 사용자 수를 보여준다', async () => {
        renderPage();
        expect(await screen.findByText('김도윤')).toBeInTheDocument();
        // '관리자'는 사용자 이름과 역할 칩 두 곳에 나타난다
        expect(screen.getAllByText('관리자').length).toBeGreaterThan(0);
        // 검색 결과 13건과 별개로 ACTIVE USER 전체 수는 12명이다
        expect(screen.getByText(/현재 활성 일반 사용자 12명/)).toBeInTheDocument();
    });

    it('검색어를 제출하면 결과가 걸리고 초기화하면 전체로 돌아온다', async () => {
        const user = userEvent.setup();
        renderPage();
        await screen.findByText('김도윤');
        await user.type(screen.getByLabelText('이름·UUID 검색'), '김도윤');
        await user.click(screen.getByRole('button', { name: '검색' }));
        expect(await screen.findByText('총 1건')).toBeInTheDocument();
        expect(screen.getByText(/현재 활성 일반 사용자 12명/)).toBeInTheDocument();
        expect(screen.queryByText('박서연')).not.toBeInTheDocument();
        await user.click(screen.getByRole('button', { name: '초기화' }));
        expect(await screen.findByText('박서연')).toBeInTheDocument();
    });

    it('행을 누르면 상세 서랍에 7개 필드와 운영 조회 링크가 나온다', async () => {
        const user = userEvent.setup();
        renderPage();
        await user.click(await screen.findByText('김도윤'));
        const dialog = await screen.findByRole('dialog');
        const uid = '00000000-0000-4000-8000-000000000001';
        expect(within(dialog).getByText('김도윤')).toBeInTheDocument();
        expect(within(dialog).getByText(uid)).toBeInTheDocument();
        expect(within(dialog).getByRole('link', { name: '응모 이력 조회' })).toHaveAttribute(
            'href',
            `/admin/entries?userId=${uid}`,
        );
        expect(within(dialog).getByRole('link', { name: '응모권 이력 조회' })).toHaveAttribute(
            'href',
            `/admin/tickets?tab=histories&userId=${uid}`,
        );
        expect(within(dialog).getByRole('link', { name: '정합성 조회' })).toHaveAttribute(
            'href',
            `/admin/tickets?tab=consistency&userId=${uid}`,
        );
    });

    it('직접 연 상세 URL이 없는 사용자면 찾을 수 없다고 안내한다', async () => {
        renderPage('/admin/users?detail=00000000-0000-4000-8000-00000000ffff');
        const dialog = await screen.findByRole('dialog');
        expect(await within(dialog).findByText('사용자를 찾을 수 없습니다.')).toBeInTheDocument();
    });

    it('목록 조회가 403이면 권한 오류를 알린다', async () => {
        server.use(
            http.get('*/v1/admin/users', () =>
                HttpResponse.json(
                    { success: false, code: 'USER-009', message: '권한이 없습니다.', data: null },
                    { status: 403 },
                ),
            ),
        );
        renderPage();
        expect(await screen.findByRole('alert')).toHaveTextContent('권한이 없습니다.');
    });

    it('검색란에 넣은 UUID는 사용자 ID 필터로 보낸다', async () => {
        const user = userEvent.setup();
        let lastParams: URLSearchParams | undefined;
        server.use(
            http.get('*/v1/admin/users', ({ request }) => {
                lastParams = new URL(request.url).searchParams;
                return HttpResponse.json({
                    success: true,
                    data: { items: [], page: 1, size: 20, totalElements: 0, totalUserCount: 12 },
                });
            }),
        );
        renderPage();
        await user.type(
            screen.getByLabelText('이름·UUID 검색'),
            '00000000-0000-4000-8000-000000000001',
        );
        await user.click(screen.getByRole('button', { name: '검색' }));
        // 36자 UUID는 keyword(최대 20자)로 보낼 수 없으므로 userId로 전달한다
        await waitFor(() =>
            expect(lastParams?.get('userId')).toBe('00000000-0000-4000-8000-000000000001'),
        );
        expect(lastParams?.get('keyword')).toBeNull();
    });

    it('잘못된 UUID를 사용자 ID로 제출하면 요청하지 않고 안내한다', async () => {
        const user = userEvent.setup();
        let calls = 0;
        server.use(
            http.get('*/v1/admin/users', () => {
                calls += 1;
                return HttpResponse.json({
                    success: true,
                    data: { items: [], page: 1, size: 20, totalElements: 0, totalUserCount: 12 },
                });
            }),
        );
        renderPage();
        await user.type(screen.getByLabelText('사용자 ID 필터'), 'not-a-uuid');
        await user.click(screen.getByRole('button', { name: '검색' }));
        expect(await screen.findByText('올바른 UUID 형식이 아닙니다.')).toBeInTheDocument();
        // 초기 목록 조회 1회만 발생하고 잘못된 제출은 요청을 늘리지 않는다
        expect(calls).toBe(1);
    });

    it('20자를 넘는 검색어는 요청하지 않고 안내한다', async () => {
        const user = userEvent.setup();
        let calls = 0;
        server.use(
            http.get('*/v1/admin/users', () => {
                calls += 1;
                return HttpResponse.json({
                    success: true,
                    data: { items: [], page: 1, size: 20, totalElements: 0, totalUserCount: 12 },
                });
            }),
        );
        renderPage();
        // keyword 계약 상한은 20자다 — 초과하면 서버 요청 전에 안내한다
        await user.type(screen.getByLabelText('이름·UUID 검색'), '가'.repeat(21));
        await user.click(screen.getByRole('button', { name: '검색' }));
        expect(await screen.findByText('검색어는 20자 이하여야 합니다.')).toBeInTheDocument();
        expect(calls).toBe(1);
    });
});
