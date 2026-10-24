import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it } from 'vitest';

import { server } from '@mocks/server';

import { AdminEventsPage } from './AdminEventsPage';

function renderPage() {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return render(
        <QueryClientProvider client={client}>
            <MemoryRouter initialEntries={['/admin/events']}>
                <Routes>
                    <Route path="/admin/events" element={<AdminEventsPage />} />
                </Routes>
            </MemoryRouter>
        </QueryClientProvider>,
    );
}

// 목록 요청(AE01)의 쿼리만 모은다 — 상태별 건수 등 다른 요청은 거른다
const listRequests: URLSearchParams[] = [];
const onRequest = ({ request }: { request: Request }) => {
    const url = new URL(request.url);
    if (url.pathname.endsWith('/v1/admin/events')) listRequests.push(url.searchParams);
};
afterEach(() => {
    server.events.removeListener('request:start', onRequest);
    listRequests.length = 0;
});

describe('AdminEventsPage 모집 기간', () => {
    it('입력한 날짜를 YYYY-MM-DD 그대로 보내고, 같은 날짜도 검색된다', async () => {
        server.events.on('request:start', onRequest);
        const user = userEvent.setup();
        renderPage();
        await screen.findByText(/총 \d+건/);

        await user.click(screen.getByRole('button', { name: /모집 기간/ }));
        await user.type(screen.getByLabelText('모집 기간 시작일'), '2026-10-10');
        await user.type(screen.getByLabelText('모집 기간 종료일'), '2026-10-10');
        await user.click(screen.getByRole('button', { name: '적용' }));

        await waitFor(() =>
            expect(listRequests.some((params) => params.get('from') === '2026-10-10')).toBe(true),
        );
        const sent = listRequests.find((params) => params.get('from') === '2026-10-10')!;
        // 끝 날짜를 다음 날 ISO 시각으로 바꾸지 않는다 — 경계는 서버가 계산한다 (AE01, 400 COMMON-005 방지)
        expect(sent.get('to')).toBe('2026-10-10');
        expect(await screen.findByText(/총 \d+건/)).toBeInTheDocument();
        expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });
});
