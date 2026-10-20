import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { expect, it } from 'vitest';

import { server } from '@mocks/server';
import { VirtualClockProvider } from '@shared/model/virtualClock';

import { AdminDashboardPage } from './AdminDashboardPage';

it('대시보드는 공통 감사 조회 없이 기존 운영 패널을 표시한다', async () => {
    const requests: string[] = [];
    const observe = ({ request }: { request: Request }) => {
        requests.push(new URL(request.url).pathname);
    };
    server.events.on('request:start', observe);
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const view = render(
        <QueryClientProvider client={client}>
            <VirtualClockProvider>
                <MemoryRouter>
                    <AdminDashboardPage />
                </MemoryRouter>
            </VirtualClockProvider>
        </QueryClientProvider>,
    );
    try {
        expect(await screen.findByRole('heading', { name: '지금 처리할 일' })).toBeInTheDocument();
        await waitFor(() => expect(client.isFetching()).toBe(0));
        expect(requests.length).toBeGreaterThan(0);
        expect(requests.filter((path) => /\/v1\/admin\/audit-logs(?:\/|$)/.test(path))).toEqual([]);
        expect(screen.queryByText('최근 운영 기록')).not.toBeInTheDocument();
        expect(view.container.querySelector('a[href="/admin/audit"]')).toBeNull();
        expect(view.container.querySelector('a[href^="/admin/events"]')).not.toBeNull();
    } finally {
        view.unmount();
        client.clear();
        server.events.removeListener('request:start', observe);
    }
});
