import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { Link, MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import { server } from '@mocks/server';

import { AdminEntriesPage } from './AdminEntriesPage';

const EVENT_ID = '10000000-0000-4000-8000-000000000001';
const USER_ID = '00000000-0000-4000-8000-000000000001';

function renderPage(initialEntry = '/admin/entries') {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return render(
        <QueryClientProvider client={client}>
            <MemoryRouter initialEntries={[initialEntry]}>
                <AdminEntriesPage />
            </MemoryRouter>
        </QueryClientProvider>,
    );
}

describe('AdminEntriesPage', () => {
    it('기본 보기에서 접수·거절 응모 이력을 보여준다', async () => {
        renderPage();
        expect((await screen.findAllByText('10월 럭키 드로우')).length).toBeGreaterThan(0);
        expect(screen.getAllByText('접수').length).toBeGreaterThan(0);
        expect(screen.getAllByText('거절').length).toBeGreaterThan(0);
        // 거절 건은 요청 장수를 보존하고 차감은 0이다
        expect(screen.getAllByText('응모권이 부족합니다.').length).toBeGreaterThan(0);
    });

    it('사용자 필터 링크로 들어오면 해당 사용자 응모만 보여준다', async () => {
        renderPage(`/admin/entries?userId=${USER_ID}`);
        expect(await screen.findByText('PLATINUM 특별 추첨')).toBeInTheDocument();
        expect(screen.getByText('총 2건')).toBeInTheDocument();
    });

    it('전체 응모 조회로 이동하면 이전 사용자 필터가 남지 않는다', async () => {
        const user = userEvent.setup();
        const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
        render(
            <QueryClientProvider client={client}>
                <MemoryRouter initialEntries={[`/admin/entries?userId=${USER_ID}`]}>
                    <Link to="/admin/entries">전체 응모 조회</Link>
                    <AdminEntriesPage />
                </MemoryRouter>
            </QueryClientProvider>,
        );
        expect(await screen.findByText('PLATINUM 특별 추첨')).toBeInTheDocument();
        await user.click(screen.getByRole('link', { name: '전체 응모 조회' }));
        // URL의 userId가 사라지면 필터가 해제돼 전체 목록으로 돌아온다
        expect(await screen.findAllByText('10월 럭키 드로우')).not.toHaveLength(0);
        expect(screen.queryByText('총 2건')).not.toBeInTheDocument();
    });

    it('참여자 URL의 eventId가 사라지면 입력 안내로 돌아간다', async () => {
        const user = userEvent.setup();
        const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
        render(
            <QueryClientProvider client={client}>
                <MemoryRouter
                    initialEntries={[`/admin/entries?view=participants&eventId=${EVENT_ID}`]}
                >
                    <Link to="/admin/entries?view=participants">참여자 조회 초기화</Link>
                    <AdminEntriesPage />
                </MemoryRouter>
            </QueryClientProvider>,
        );
        expect(await screen.findByText(/총 2명/)).toBeInTheDocument();
        await user.click(screen.getByRole('link', { name: '참여자 조회 초기화' }));
        expect(
            await screen.findByText('이벤트 ID를 입력하면 참여자를 조회합니다.'),
        ).toBeInTheDocument();
    });

    it('참여자 보기에서 이벤트 참여자를 정렬해 보여준다', async () => {
        renderPage(`/admin/entries?view=participants&eventId=${EVENT_ID}`);
        expect(await screen.findByText(/총 2명/)).toBeInTheDocument();
        expect(screen.getByText('2장')).toBeInTheDocument();
    });

    it('참여자 보기에서 이벤트 ID가 없으면 요청 없이 입력을 안내한다', async () => {
        let calls = 0;
        server.use(
            http.get('*/v1/admin/events/*/participants', () => {
                calls += 1;
                return HttpResponse.json({
                    success: true,
                    data: { items: [], page: 1, size: 20, totalElements: 0 },
                });
            }),
        );
        renderPage('/admin/entries?view=participants');
        expect(
            await screen.findByText('이벤트 ID를 입력하면 참여자를 조회합니다.'),
        ).toBeInTheDocument();
        expect(calls).toBe(0);
    });

    it('존재하지 않는 이벤트의 참여자 조회는 찾을 수 없다고 알린다', async () => {
        renderPage('/admin/entries?view=participants&eventId=10000000-0000-4000-8000-00000000ffff');
        expect(await screen.findByRole('alert')).toHaveTextContent('이벤트를 찾을 수 없습니다.');
    });

    it('응모 이력의 사용자 ID 링크가 사용자 상세로 연결된다', async () => {
        renderPage();
        await screen.findAllByText('10월 럭키 드로우');
        const links = screen.getAllByRole('link', { name: USER_ID });
        expect(links[0]).toHaveAttribute('href', `/admin/users?detail=${USER_ID}`);
    });

    it('보기 탭을 바꾸면 참여자 보기로 전환된다', async () => {
        const user = userEvent.setup();
        renderPage();
        await user.click(screen.getByRole('tab', { name: '이벤트 참여자' }));
        expect(
            screen.getByRole('tab', { name: '이벤트 참여자', selected: true }),
        ).toBeInTheDocument();
    });
});
