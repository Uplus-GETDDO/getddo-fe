import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { TodayRewardsBanner } from './TodayRewardsBanner';

const state = vi.hoisted(() => ({ role: 'USER', pending: false, error: false }));
vi.mock('@entities/attendance', () => ({
    useAttendanceToday: () => ({ data: { attended: true } }),
}));
vi.mock('@entities/mission', () => ({
    useMissionList: () => ({ data: [] }),
    isMissionOpen: () => true,
}));
vi.mock('@entities/user', () => ({
    useSessionStore: (select: (value: unknown) => unknown) =>
        select({ user: { role: state.role } }),
}));
vi.mock('@entities/game', () => ({
    useGameList: () => ({ data: [{ id: 'game', code: 'TAKKO_ORDER' }] }),
    useGameStatisticsList: () => [
        {
            isSuccess: !state.pending && !state.error,
            isPending: state.pending,
            isError: state.error,
            data: state.error || state.pending ? undefined : { rewardClaimedToday: true },
        },
    ],
}));
vi.mock('@features/playGame', () => ({ hasGamePlayer: () => true }));
vi.mock('@widgets/ticketWallet', () => ({ TicketWallet: () => null }));
vi.mock('@shared/model/virtualClock', () => ({
    useVirtualClock: () => ({ now: () => new Date('2026-10-20T01:00:00Z') }),
}));
vi.mock('../hooks/useSlotNumber', () => ({ useSlotNumber: (value: number) => value }));

beforeEach(() => Object.assign(state, { role: 'USER', pending: false, error: false }));
describe('게임 보상 조회 상태', () => {
    it('조회 실패를 미수령 수치나 무한 로딩으로 표시하지 않는다', () => {
        state.error = true;
        render(<TodayRewardsBanner />);
        expect(screen.getByRole('status')).toHaveTextContent(
            '오늘의 게임 보상을 불러오지 못했어요',
        );
        expect(screen.getByText('조회 실패')).toBeInTheDocument();
        expect(screen.queryByText('0 / 1')).not.toBeInTheDocument();
    });
    it.each(['ADMIN', ''])('%s는 비활성 통계 쿼리를 기다리지 않는다', (role) => {
        state.role = role;
        state.pending = true;
        render(<TodayRewardsBanner />);
        expect(screen.getAllByText('0 / 0').length).toBeGreaterThan(0);
        expect(screen.getByText('오늘 받을 응모권을 다 모았어요!')).toBeInTheDocument();
    });
    it('조회 성공 시 실제 지급 상태를 표시한다', () => {
        render(<TodayRewardsBanner />);
        expect(screen.getByText('1 / 1')).toBeInTheDocument();
    });
});
