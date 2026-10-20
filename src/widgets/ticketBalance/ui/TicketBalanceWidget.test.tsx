import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { TicketBalanceWidget } from './TicketBalanceWidget';

const state = vi.hoisted(() => ({ role: 'USER', pending: true }));
vi.mock('@entities/attendance', () => ({ useAttendanceToday: () => ({ isPending: false }) }));
vi.mock('@entities/mission', () => ({ useMissionList: () => ({ data: [], isPending: false }) }));
vi.mock('@entities/user', () => ({
    useSessionStore: (select: (value: unknown) => unknown) =>
        select({ user: { role: state.role } }),
}));
vi.mock('@entities/game', () => ({
    useGameList: () => ({
        data: [{ id: 'game', code: 'TAKKO_ORDER', name: '주문' }],
        isPending: false,
    }),
    useGameStatisticsList: () => [
        {
            isPending: state.pending,
            data: state.pending ? undefined : { gameId: 'game', rewardClaimedToday: true },
        },
    ],
    getGameContent: () => ({ heroImage: null }),
    gameDetailPath: () => '/game',
    GameTicketCard: ({ rewardedToday }: { rewardedToday?: boolean }) => (
        <p>{rewardedToday ? '오늘 지급 완료' : '보상 미확인'}</p>
    ),
}));
vi.mock('@features/playGame', () => ({ hasGamePlayer: () => true }));

beforeEach(() => Object.assign(state, { role: 'USER', pending: true }));
describe('적립 카드의 통계 로딩', () => {
    it('통계가 도착하기 전 카드를 정렬해 노출하지 않는다', () => {
        const { rerender } = render(
            <MemoryRouter>
                <TicketBalanceWidget />
            </MemoryRouter>,
        );
        expect(screen.getByRole('status')).toBeInTheDocument();
        expect(screen.queryByText('보상 미확인')).not.toBeInTheDocument();
        state.pending = false;
        rerender(
            <MemoryRouter>
                <TicketBalanceWidget />
            </MemoryRouter>,
        );
        expect(screen.queryByRole('status')).not.toBeInTheDocument();
        expect(screen.getByText('오늘 지급 완료')).toBeInTheDocument();
    });
    it('ADMIN의 비활성 통계는 로딩에서 제외한다', () => {
        state.role = 'ADMIN';
        render(
            <MemoryRouter>
                <TicketBalanceWidget />
            </MemoryRouter>,
        );
        expect(screen.queryByRole('status')).not.toBeInTheDocument();
    });
});
