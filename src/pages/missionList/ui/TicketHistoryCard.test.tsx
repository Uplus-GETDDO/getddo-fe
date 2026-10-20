import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useTicketHistories } from '@entities/ticket';

import { TicketHistoryCard } from './TicketHistoryCard';

const state = vi.hoisted(() => ({
    items: [{ id: 'history-1', reason: '기존 이력' }],
    isPending: false,
    isError: false,
    cursorError: false,
    hasNextPage: true,
    isFetching: false,
    dataUpdatedAt: 0,
    refetch: vi.fn(),
}));
vi.mock('@entities/ticket', () => ({
    useTicketHistories: vi.fn(() => state),
    TicketHistoryRow: ({ item }: { item: { reason: string } }) => <li>{item.reason}</li>,
}));

function renderCard() {
    return render(
        <MemoryRouter>
            <TicketHistoryCard />
        </MemoryRouter>,
    );
}

describe('미션 응모권 이력 미리보기', () => {
    beforeEach(() => {
        state.items = [{ id: 'history-1', reason: '기존 이력' }];
        state.isPending = false;
        state.isError = false;
        state.cursorError = false;
        state.isFetching = false;
        state.hasNextPage = true;
        vi.clearAllMocks();
    });
    it('첫 조회 로딩 상태를 보조 기술에 알린다', () => {
        state.isPending = true;
        renderCard();
        expect(screen.getByRole('status')).toHaveTextContent('응모권 내역을 불러오는 중');
    });
    it('최근 10건만 받는다', () => {
        renderCard();
        expect(useTicketHistories).toHaveBeenCalledWith({ size: 10 });
    });
    it('내역이 더 있으면 전체보기로 마이페이지 응모권 내역에 넘긴다', () => {
        renderCard();
        expect(screen.getByRole('link', { name: '전체보기' })).toHaveAttribute(
            'href',
            '/my-tickets',
        );
        expect(screen.queryByRole('button', { name: '더 보기' })).not.toBeInTheDocument();
    });
    it('마지막 페이지면 전체보기가 없다', () => {
        state.hasNextPage = false;
        renderCard();
        expect(screen.queryByRole('link', { name: '전체보기' })).not.toBeInTheDocument();
    });
    it('다시 받는 중이면 제목 옆 갱신 표시가 받는 중을 알린다', () => {
        state.isFetching = true;
        renderCard();
        expect(screen.getByRole('button', { name: '지금 다시 받기' })).toHaveTextContent(
            '새로 받는 중',
        );
    });
    it('재조회 오류에도 기존 이력을 유지하고 다시 시도하면 현재 조건을 재조회한다', () => {
        state.isError = true;
        renderCard();
        expect(screen.getByText('기존 이력')).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: '갱신에 실패했어요. 다시 받기' }));
        expect(state.refetch).toHaveBeenCalledOnce();
    });
    it('비어 있는 실패는 실패 칸만 띄우고 제목 옆 갱신 표시는 숨긴다', () => {
        state.isError = true;
        state.items = [];
        renderCard();
        expect(screen.getByText('응모권 내역을 불러오지 못했어요')).toBeInTheDocument();
        expect(
            screen.queryByRole('button', { name: '갱신에 실패했어요. 다시 받기' }),
        ).not.toBeInTheDocument();
    });
});

describe('좁아진 응모권 내역 칸', () => {
    it('넓은 화면용 짧은 제목을 두고 갱신 표시 글은 화면 낭독기·툴팁으로 남긴다', () => {
        state.items = [{ id: 'history-1', reason: '기존 이력' }];
        state.isError = false;
        state.isFetching = false;
        render(
            <MemoryRouter>
                <TicketHistoryCard narrow />
            </MemoryRouter>,
        );
        expect(screen.getByText('응모권 내역')).toHaveClass('hidden', 'lg:inline');
        const refresh = screen.getByRole('button', { name: '지금 다시 받기' });
        expect(refresh.querySelector('[aria-live]')).toHaveClass('lg:sr-only');
    });
});
