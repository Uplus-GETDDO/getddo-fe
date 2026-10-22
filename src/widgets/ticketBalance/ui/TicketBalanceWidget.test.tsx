import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type * as MissionModule from '@entities/mission';

import { TicketBalanceWidget } from './TicketBalanceWidget';

const NOW = new Date('2026-10-21T03:00:00Z');
const state = vi.hoisted(() => ({
    role: 'USER',
    pending: true,
    missions: [] as { id: string; title: string; startsAt: string; endsAt: string }[],
}));
vi.mock('@entities/attendance', () => ({
    ATTENDANCE_THUMBNAIL: 'attendance.png',
    useAttendanceToday: () => ({ isPending: false }),
}));
vi.mock('@entities/mission', async (importOriginal) => ({
    isMissionOpen: (await importOriginal<typeof MissionModule>()).isMissionOpen,
    missionThumbnail: () => null,
    useMissionList: () => ({
        data: state.missions.map((mission) => ({
            ...mission,
            rewardTicketCount: 1,
            completed: false,
        })),
        isPending: false,
    }),
}));
vi.mock('@shared/model/virtualClock', () => ({ useVirtualClock: () => ({ now: () => NOW }) }));
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

beforeEach(() => Object.assign(state, { role: 'USER', pending: true, missions: [] }));
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
    it('기간이 끝났거나 시작 전인 미션은 오늘 받을 수 있는 카드에서 뺀다', () => {
        state.pending = false;
        state.missions = [
            {
                id: 'open',
                title: '진행 중 설문',
                startsAt: '2026-10-20T00:00:00Z',
                endsAt: '2026-10-22T00:00:00Z',
            },
            {
                id: 'ended',
                title: '끝난 퀴즈',
                startsAt: '2026-10-01T00:00:00Z',
                endsAt: '2026-10-20T00:00:00Z',
            },
            {
                id: 'soon',
                title: '예정 설문',
                startsAt: '2026-10-25T00:00:00Z',
                endsAt: '2026-10-30T00:00:00Z',
            },
        ];
        render(
            <MemoryRouter>
                <TicketBalanceWidget />
            </MemoryRouter>,
        );
        expect(screen.getByText('진행 중 설문')).toBeInTheDocument();
        expect(screen.queryByText('끝난 퀴즈')).not.toBeInTheDocument();
        expect(screen.queryByText('예정 설문')).not.toBeInTheDocument();
    });
});
