import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
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
        // 최근 지급이 맨 위라 첫 쪽 사용자는 날마다 다르다 — 이름 대신 표에 행이 찼는지 본다
        expect((await screen.findAllByRole('row')).length).toBeGreaterThan(1);
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

    it('검색 조건에 맞는 결과가 없으면 빈 목록을 안내한다', async () => {
        const user = userEvent.setup();
        renderPage('/admin/tickets?tab=grants');
        await user.type(screen.getByLabelText('사용자 이름 검색'), '없는이름');
        await user.click(screen.getByRole('button', { name: '검색' }));
        expect(await screen.findByText('해당하는 지급 이력이 없습니다.')).toBeInTheDocument();
    });
});
