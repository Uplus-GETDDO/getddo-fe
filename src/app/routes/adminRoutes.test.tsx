import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { useSessionStore } from '@entities/user';
import { VirtualClockProvider } from '@shared/model/virtualClock';

import { adminRoutes } from './adminRoutes';

function renderRoute(path: string) {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const router = createMemoryRouter(
        [
            ...adminRoutes,
            { path: '/login', element: <p>로그인 화면</p> },
            { path: '/', element: <p>사용자 홈</p> },
        ],
        { initialEntries: [path] },
    );
    render(
        <QueryClientProvider client={client}>
            <VirtualClockProvider>
                <RouterProvider router={router} />
            </VirtualClockProvider>
        </QueryClientProvider>,
    );
    return { client, router };
}

beforeEach(() => {
    useSessionStore.getState().selectUser({
        id: 'admin-audit-cleanup',
        name: '관리자',
        role: 'ADMIN',
        membership: 'excellent',
        personaLabel: null,
    });
});
afterEach(() => useSessionStore.getState().signOut());

describe('제외된 공통 감사 경로', () => {
    it.each(['/admin/audit', '/admin/audit/sample-id', '/admin/audit?page=2'])(
        '%s는 관리자 셸의 404를 표시한다',
        async (path) => {
            const { client, router } = renderRoute(path);
            try {
                expect(
                    await screen.findByRole('heading', { name: '페이지를 찾을 수 없습니다' }),
                ).toBeInTheDocument();
                for (const nav of screen.getAllByRole('navigation')) {
                    expect(
                        within(nav).queryByRole('link', { name: '감사 로그' }),
                    ).not.toBeInTheDocument();
                    expect(within(nav).getByRole('link', { name: '이벤트 관리' })).toHaveAttribute(
                        'href',
                        '/admin/events',
                    );
                    expect(within(nav).getByRole('link', { name: '추첨 관리' })).toHaveAttribute(
                        'href',
                        '/admin/draw',
                    );
                }
                const [drawLink] = screen.getAllByRole('link', { name: '추첨 관리' });
                if (!drawLink) throw new Error('추첨 관리 링크가 없습니다');
                await userEvent.click(drawLink);
                expect(
                    await screen.findByRole('heading', { name: '추첨 관리' }),
                ).toBeInTheDocument();
                expect(router.state.location.pathname).toBe('/admin/draw');
            } finally {
                client.clear();
                router.dispose();
            }
        },
    );

    it('비로그인은 로그인으로 이동한다', async () => {
        useSessionStore.getState().signOut();
        const { client, router } = renderRoute('/admin/audit');
        expect(await screen.findByText('로그인 화면')).toBeInTheDocument();
        client.clear();
        router.dispose();
    });

    it('일반 사용자는 사용자 홈으로 이동한다', async () => {
        useSessionStore.getState().selectUser({
            id: 'user-audit-cleanup',
            name: '사용자',
            role: 'USER',
            membership: 'excellent',
            personaLabel: null,
        });
        const { client, router } = renderRoute('/admin/audit');
        expect(await screen.findByText('사용자 홈')).toBeInTheDocument();
        client.clear();
        router.dispose();
    });
});
