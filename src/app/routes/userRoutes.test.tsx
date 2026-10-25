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
        // handle에는 탭 제목도 함께 실리므로 이 화면이 보는 fullBleed만 확인한다
        expect(route?.handle).toMatchObject({ fullBleed: true });
        render(<>{route?.element}</>);
        expect(screen.getByRole('status')).toHaveTextContent('불러오는 중…');
        expect(await screen.findByText('게임 상세')).toBeInTheDocument();
        expect(screen.queryByRole('status')).not.toBeInTheDocument();
    });
    // 서버 발표 알림이 보내는 linkUrl 경로 — 등록되지 않으면 알림 클릭이 404로 떨어진다
    it('발표 알림 linkUrl 경로(/events/:id/results)가 라우트에 등록돼 있다', () => {
        const paths = userRoutes.flatMap((item) => item.children ?? []).map((item) => item.path);
        expect(paths).toContain('/events/:id/results');
    });
});
