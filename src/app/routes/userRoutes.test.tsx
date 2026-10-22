import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@app/layouts/UserLayout', () => ({ UserLayout: () => null }));
vi.mock('@pages/home/HomePage', () => ({ HomePage: () => null }));
vi.mock('@pages/login/LoginPage', () => ({ LoginPage: () => null }));
vi.mock('@pages/gameDetail/GameDetailPage', () => ({ GameDetailPage: () => <p>게임 상세</p> }));

import { userRoutes } from './userRoutes';

describe('사용자 초기 경로의 게임 코드 분리', () => {
    it('게임 코드를 받는 동안 로딩을 알리고 로드되면 상세를 표시한다', async () => {
        const route = userRoutes
            .flatMap((item) => item.children ?? [])
            .find((item) => item.path === '/missions/games/:gameId');
        expect(route?.handle).toEqual({ fullBleed: true });
        render(<>{route?.element}</>);
        expect(screen.getByRole('status')).toHaveTextContent('불러오는 중…');
        expect(await screen.findByText('게임 상세')).toBeInTheDocument();
        expect(screen.queryByRole('status')).not.toBeInTheDocument();
    });
});
