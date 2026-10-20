import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { TicketHistoryCard } from './TicketHistoryCard';

const state = vi.hoisted(() => ({
    items: [{ id: 'history-1', reason: '기존 이력' }],
    isFetchNextPageError: false,
    isPending: false,
    isError: false,
    cursorError: false,
    hasNextPage: true,
    isFetching: false,
    isFetchingNextPage: false,
    fetchNextPage: vi.fn(),
    refetch: vi.fn(),
}));
vi.mock('@entities/ticket', () => ({
    useTicketHistories: () => state,
    TicketHistoryRow: ({ item }: { item: { reason: string } }) => <li>{item.reason}</li>,
}));

describe('미션 응모권 이력 더보기', () => {
    beforeEach(() => {
        state.isFetchNextPageError = false;
        state.isPending = false;
        state.isError = false;
        state.cursorError = false;
        state.isFetching = false;
        state.hasNextPage = true;
        vi.clearAllMocks();
    });
    it('첫 조회 로딩 상태를 보조 기술에 알린다', () => {
        state.isPending = true;
        render(<TicketHistoryCard />);
        expect(screen.getByRole('status')).toHaveTextContent('응모권 내역을 불러오는 중');
    });
    it('더보기를 누를 때만 다음 페이지를 요청한다', () => {
        render(<TicketHistoryCard />);
        expect(state.fetchNextPage).not.toHaveBeenCalled();
        fireEvent.click(screen.getByRole('button', { name: '더 보기' }));
        expect(state.fetchNextPage).toHaveBeenCalledExactlyOnceWith({ cancelRefetch: false });
    });
    it('다음 페이지 오류에도 기존 이력을 유지하고 다음 페이지를 재시도한다', () => {
        state.isError = true;
        state.isFetchNextPageError = true;
        render(<TicketHistoryCard />);
        expect(screen.getByText('기존 이력')).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: '다시 시도' }));
        expect(state.fetchNextPage).toHaveBeenCalledOnce();
        expect(state.refetch).not.toHaveBeenCalled();
    });
    it('백그라운드 재조회 오류는 다음 페이지 대신 현재 조건을 재조회한다', () => {
        state.isError = true;
        render(<TicketHistoryCard />);
        fireEvent.click(screen.getByRole('button', { name: '다시 시도' }));
        expect(state.refetch).toHaveBeenCalledOnce();
        expect(state.fetchNextPage).not.toHaveBeenCalled();
    });
    it('요청 중에는 더보기를 비활성화한다', () => {
        state.isFetching = true;
        render(<TicketHistoryCard />);
        expect(screen.getByRole('button', { name: '더 보기' })).toBeDisabled();
    });
    it('중복 커서는 진행을 멈추고 조건 재조회로 복구한다', () => {
        state.cursorError = true;
        render(<TicketHistoryCard />);
        expect(screen.queryByRole('button', { name: '더 보기' })).not.toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: '다시 시도' }));
        expect(state.refetch).toHaveBeenCalledOnce();
    });
    it('마지막 페이지에서는 더보기 버튼이 없다', () => {
        state.hasNextPage = false;
        render(<TicketHistoryCard />);
        expect(screen.queryByRole('button', { name: '더 보기' })).not.toBeInTheDocument();
    });
});
