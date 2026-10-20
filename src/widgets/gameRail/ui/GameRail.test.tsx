import { render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';

import { GameRail } from './GameRail';

vi.mock('@entities/user', () => ({ useSessionStore: () => true }));
vi.mock('@entities/game', () => ({
    useGameList: () => ({
        data: [
            { id: 'uuid-order', code: 'TAKKO_ORDER', name: '주문' },
            { id: 'uuid-unknown', code: 'UNKNOWN', name: '후보' },
        ],
        isPending: false,
    }),
    useGameStatisticsList: () => [{ data: { gameId: 'uuid-order', rewardClaimedToday: true } }],
    gameDetailPath: (id: string) => '/games/' + id,
    GameTicketCard: ({
        game,
        rewardedToday,
        fluid,
        href,
    }: {
        game: { name: string };
        rewardedToday?: boolean;
        fluid?: boolean;
        href: string;
    }) => (
        <a href={href}>
            {game.name} {rewardedToday ? '오늘 받음' : '미확인'} {fluid ? '채움' : '가로'}
        </a>
    ),
}));
vi.mock('@features/playGame', () => ({ hasGamePlayer: (code: string) => code === 'TAKKO_ORDER' }));
it('준비된 code만 표시하고 두 반응형 배치에 서버 보상을 전달한다', () => {
    render(<GameRail title="게임" fill />);
    expect(screen.queryByText(/후보/)).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: '주문 오늘 받음 채움' })).toHaveAttribute(
        'href',
        '/games/uuid-order',
    );
    expect(screen.getByRole('link', { name: '주문 오늘 받음 가로' })).toBeInTheDocument();
});
