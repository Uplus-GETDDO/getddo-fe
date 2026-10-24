import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { QuickLinks } from './QuickLinks';

const state = vi.hoisted(() => ({
    role: 'USER',
    success: true,
    claimed: false,
    /** 받아 둔 현황이 있는 채로 다시 받기에 실패한 상태 (TanStack Query: isSuccess false, data 유지) */
    refetchFailed: false,
    /** 미션 목록 응답 — undefined면 아직 받기 전 */
    missions: [] as unknown[] | undefined,
    statistics: vi.fn(),
}));
vi.mock('@entities/attendance', () => ({
    useAttendanceToday: () => ({ data: { attended: true } }),
}));
vi.mock('@entities/mission', () => ({
    useLatestMissions: () => ({ data: state.missions }),
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
                isSuccess: state.success && !state.refetchFailed,
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
    Object.assign(state, {
        role: 'USER',
        success: true,
        claimed: false,
        refetchFailed: false,
        missions: [],
    });
    state.statistics.mockClear();
});
describe('홈 게임 바로가기 계약 통합', () => {
    it('code로 준비된 게임을 고르고 UUID로 통계를 조회한다', () => {
        render(
            <MemoryRouter>
                <QuickLinks />
            </MemoryRouter>,
        );
        expect(state.statistics).toHaveBeenCalledWith(['uuid-order'], true, { passive: true });
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
    it('폴링 한 번이 실패해도 받아 둔 완료 상태를 유지한다', () => {
        state.claimed = true;
        state.refetchFailed = true;
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
        expect(state.statistics).toHaveBeenCalledWith(['uuid-order'], false, { passive: true });
        expect(screen.queryByRole('link', { name: '게임 보상 완료' })).not.toBeInTheDocument();
    });
});

describe('홈 퀴즈·설문 바로가기', () => {
    it('미션 응답 전에는 이름 대신 스켈레톤을 둔다', () => {
        state.missions = undefined;
        render(
            <MemoryRouter>
                <QuickLinks />
            </MemoryRouter>,
        );
        const link = screen.getByRole('link', { name: '퀴즈·설문' });
        expect(link.querySelector('[data-slot="skeleton"]')).toBeInTheDocument();
    });
    it('열린 미션이 없으면 바로 완료로 보인다', () => {
        render(
            <MemoryRouter>
                <QuickLinks />
            </MemoryRouter>,
        );
        expect(screen.getByRole('link', { name: '퀴즈·설문 완료' })).toBeInTheDocument();
    });
});
