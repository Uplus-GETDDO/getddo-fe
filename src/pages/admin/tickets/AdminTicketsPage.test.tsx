import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, MemoryRouter, RouterProvider } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

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

describe('AdminTicketsPage', () => {
    it('정합성 탭이 기본이고 시드된 불일치 응모권을 보여준다', async () => {
        renderPage();
        expect(screen.getByRole('tab', { name: '정합성', selected: true })).toBeInTheDocument();
        expect(await screen.findByText('tk-007')).toBeInTheDocument();
        expect(screen.getByText('tk-010')).toBeInTheDocument();
        expect(screen.getByText('tk-013')).toBeInTheDocument();
    });

    it('불일치 행을 누르면 서랍에 불일치 응모권과 최근 이력이 나온다', async () => {
        const user = userEvent.setup();
        renderPage();
        await user.click(await screen.findByText('tk-007'));
        const dialog = await screen.findByRole('dialog');
        expect(await within(dialog).findByText('불일치')).toBeInTheDocument();
        expect(await within(dialog).findByText('최근 이력')).toBeInTheDocument();
        await waitFor(() =>
            expect(within(dialog).queryByText('이력이 없습니다.')).not.toBeInTheDocument(),
        );
    });

    it('일치하는 사용자도 직접 조회하면 일치로 표시한다', async () => {
        const user = userEvent.setup();
        renderPage();
        await user.type(screen.getByLabelText('사용자 직접 조회'), 'vu-doyoon');
        await user.click(screen.getByRole('button', { name: '정합성 확인' }));
        const dialog = await screen.findByRole('dialog');
        expect(await within(dialog).findByText('일치')).toBeInTheDocument();
    });

    it('없는 사용자를 조회하면 찾을 수 없다고 안내한다', async () => {
        const user = userEvent.setup();
        renderPage();
        await user.type(screen.getByLabelText('사용자 직접 조회'), 'nobody');
        await user.click(screen.getByRole('button', { name: '정합성 확인' }));
        const dialog = await screen.findByRole('dialog');
        expect(
            await within(dialog).findByText('해당 사용자를 찾을 수 없습니다.'),
        ).toBeInTheDocument();
    });

    it('탭을 바꾸면 해당 목록을 보여주고 선택 탭이 URL에 남는다', async () => {
        const user = userEvent.setup();
        renderPage('/admin/tickets?tab=grants');
        expect(screen.getByRole('tab', { name: '지급 이력', selected: true })).toBeInTheDocument();
        expect((await screen.findAllByText('김도윤')).length).toBeGreaterThan(0);
        await user.click(screen.getByRole('tab', { name: '반환 이력' }));
        expect(screen.getByRole('tab', { name: '반환 이력', selected: true })).toBeInTheDocument();
        expect((await screen.findAllByText('이벤트 취소')).length).toBeGreaterThan(0);
    });

    it('방향키로 탭을 순환 이동한다', async () => {
        const user = userEvent.setup();
        renderPage();
        screen.getByRole('tab', { name: '정합성' }).focus();
        await user.keyboard('{ArrowRight}');
        expect(screen.getByRole('tab', { name: '지급 이력', selected: true })).toHaveFocus();
        await user.keyboard('{ArrowLeft}');
        expect(screen.getByRole('tab', { name: '정합성', selected: true })).toHaveFocus();
        await user.keyboard('{ArrowLeft}');
        expect(screen.getByRole('tab', { name: '반환 이력', selected: true })).toHaveFocus();
    });

    it('사용자 상세 링크의 ?userId= 가 전체 이력 필터로 적용된다', async () => {
        renderPage('/admin/tickets?tab=histories&userId=vu-doyoon');
        expect(await screen.findByLabelText('사용자 ID 필터')).toHaveValue('vu-doyoon');
        expect(await screen.findByText(/총 \d+건/)).toBeInTheDocument();
    });

    it('정합성 링크의 ?userId= 가 해당 사용자 정합성 서랍을 바로 연다', async () => {
        renderPage('/admin/tickets?tab=consistency&userId=vu-doyoon');
        const dialog = await screen.findByRole('dialog');
        expect(await within(dialog).findByText(/일치/)).toBeInTheDocument();
    });

    it('탭을 바꿔도 ?userId= 가 유지되어 다음 탭 필터에 이어진다', async () => {
        const user = userEvent.setup();
        const { client, router } = renderRoutedPage([
            '/admin/tickets?tab=histories&userId=vu-doyoon',
        ]);
        try {
            await screen.findByLabelText('사용자 ID 필터');
            await user.click(screen.getByRole('tab', { name: '반환 이력' }));
            expect(router.state.location.search).toContain('userId=vu-doyoon');
            expect(await screen.findByLabelText('사용자 ID 필터')).toHaveValue('vu-doyoon');
        } finally {
            client.clear();
            router.dispose();
        }
    });

    it('같은 경로에서 URL의 사용자가 바뀌면 이전 사용자 필터가 남지 않는다', async () => {
        const { client, router } = renderRoutedPage(
            ['/admin/tickets?tab=histories&userId=vu-doyoon', '/admin/tickets?tab=histories'],
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
            [
                '/admin/tickets?tab=histories&date=2026-10-19&operationType=USE',
                '/admin/tickets?tab=histories',
            ],
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

    it('같은 경로에서 링크 날짜가 바뀌면 지급 탭의 이전 날짜가 남지 않는다', async () => {
        const { client, router } = renderRoutedPage(
            ['/admin/tickets?tab=grants&date=2026-10-19', '/admin/tickets?tab=grants'],
            0,
        );
        try {
            expect(await screen.findByLabelText('지급일 시작일')).toHaveValue('2026-10-19');
            await act(() => router.navigate(1));
            await waitFor(() => expect(screen.getByLabelText('지급일 시작일')).toHaveValue(''));
        } finally {
            client.clear();
            router.dispose();
        }
    });

    it('검색 조건에 맞는 결과가 없으면 빈 목록을 안내한다', async () => {
        const user = userEvent.setup();
        renderPage('/admin/tickets?tab=grants');
        await user.type(screen.getByLabelText('사용자 이름 검색'), '없는이름');
        await user.click(screen.getByRole('button', { name: '검색' }));
        expect(await screen.findByText('해당하는 지급 이력이 없습니다.')).toBeInTheDocument();
    });
});
