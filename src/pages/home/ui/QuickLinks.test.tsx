import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { QuickLinks } from './QuickLinks';

const state = vi.hoisted(() => ({
    role: 'USER',
    success: true,
    claimed: false,
    statistics: vi.fn(),
}));
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
    useGameList: () => ({
        data: [
            { id: 'uuid-order', code: 'TAKKO_ORDER' },
            { id: 'uuid-unknown', code: 'UNKNOWN' },
        ],
    }),
    useGameStatisticsList: (...args: unknown[]) => {
        state.statistics(...args);
        return [
            {
                isSuccess: state.success,
                data: state.success ? { rewardClaimedToday: state.claimed } : undefined,
            },
        ];
    },
}));
vi.mock('@features/playGame', () => ({ hasGamePlayer: (code: string) => code === 'TAKKO_ORDER' }));
vi.mock('@shared/model/virtualClock', () => ({
    useVirtualClock: () => ({ now: () => new Date('2026-10-20T01:00:00Z') }),
}));
beforeEach(() => {
    Object.assign(state, { role: 'USER', success: true, claimed: false });
    state.statistics.mockClear();
});
describe('홈 게임 바로가기 계약 통합', () => {
    it('code로 준비된 게임을 고르고 UUID로 통계를 조회한다', () => {
        render(
            <MemoryRouter>
                <QuickLinks />
            </MemoryRouter>,
        );
        expect(state.statistics).toHaveBeenCalledWith(['uuid-order'], true);
        expect(
            screen.getByRole('link', { name: '오늘 할 일이 남았어요게임하러 가기' }),
        ).toHaveAttribute('href', '/missions#today-games');
    });
    it('횟수 제한 대신 실제 당일 보상을 완료 상태로 표시한다', () => {
        state.claimed = true;
        render(
            <MemoryRouter>
                <QuickLinks />
            </MemoryRouter>,
        );
        expect(screen.getByRole('link', { name: '게임 보상 완료' })).toBeInTheDocument();
    });
    it('통계 미확인을 보상 완료로 표시하지 않는다', () => {
        state.success = false;
        render(
            <MemoryRouter>
                <QuickLinks />
            </MemoryRouter>,
        );
        expect(screen.queryByRole('link', { name: '게임 보상 완료' })).not.toBeInTheDocument();
    });
    it('ADMIN은 통계를 요청하지 않는다', () => {
        state.role = 'ADMIN';
        render(
            <MemoryRouter>
                <QuickLinks />
            </MemoryRouter>,
        );
        expect(state.statistics).toHaveBeenCalledWith(['uuid-order'], false);
        expect(screen.queryByRole('link', { name: '게임 보상 완료' })).not.toBeInTheDocument();
    });
});
