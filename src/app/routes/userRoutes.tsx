import type { ComponentType } from 'react';
import type { RouteObject } from 'react-router-dom';

import { lazy, Suspense, useEffect } from 'react';

import { UserGuard } from '@app/routes/UserGuard';
import { LoginPage } from '@pages/login/LoginPage';
import { NotFoundPage } from '@pages/notFound/NotFoundPage';
import { env } from '@shared/config/env';
import { RouteErrorFallback } from '@shared/ui/route-error-boundary';

/**
 * 코드 조각을 받는 동안의 자리 — 화면에는 아무것도 그리지 않고 화면 낭독기에만 알린다.
 * 예전에는 공용 상세 스켈레톤을 꽉 채워 그려, 새로고침·첫 진입마다 어느 화면과도 다른 모양이 한 번 번쩍인 뒤
 * 페이지 자신의 스켈레톤으로 바뀌었다. 조각은 금방 오고, 데이터를 기다리는 모양은 각 페이지가 그린다 (관리자와 같음)
 */
const ChunkLoading = () => (
    <p role="status" className="sr-only">
        불러오는 중…
    </p>
);

// 관리자 경로와 같은 로딩 경계를 페이지에 둔다. 청크를 받는 동안 사용자 셸을 유지한다.
const lazyPage = (importer: () => Promise<{ default: ComponentType }>) => {
    const Page = lazy(importer);
    return (
        <Suspense fallback={<ChunkLoading />}>
            <Page />
        </Suspense>
    );
};

// 사용자 셸(헤더·푸터)도 관리자처럼 lazy로 분리해 /login 초기 번들에서 제외한다
const UserLayoutLazy = lazy(() =>
    import('@app/layouts/UserLayout').then((m) => ({ default: m.UserLayout })),
);

// 디자인 갤러리는 개발용 화면 — 운영 빌드에서는 라우트 자체를 등록하지 않는다
const UiGalleryPageLazy = lazy(() =>
    import('@pages/uiGallery/UiGalleryPage').then((m) => ({ default: m.UiGalleryPage })),
);

// /login 체류 동안 사용자 셸·홈 청크를 미리 받는다 — 셸이 lazy라 진입 시 자식 페이지 청크가
// 직렬로 이어지는 워터폴을 없애기 위함이다 (GD-334 후속). 로그인 후 진입 경로는 '/'로 고정이다.
// pages→app 참조가 금지라 라우트 단에서 처리한다.
// import()를 컴포넌트 몸에 두면 React Compiler가 최적화를 건너뛴다 — 모듈 함수로 둔다 (GD-347)
const prefetchUserShell = () => {
    void import('@app/layouts/UserLayout');
    void import('@pages/home/HomePage');
};

const LoginWithShellPrefetch = () => {
    useEffect(() => {
        // 첫 페인트 창의 대역을 양보한다 — 로그인 체류는 수 초라 유휴 시점 발사로도 목적을 채운다 (GD-342).
        if ('requestIdleCallback' in window) {
            const id = window.requestIdleCallback(prefetchUserShell);
            return () => window.cancelIdleCallback(id);
        }
        const id = setTimeout(prefetchUserShell, 0);
        return () => clearTimeout(id);
    }, []);
    return <LoginPage />;
};

export const userRoutes: RouteObject[] = [
    {
        path: '/login',
        handle: { title: '로그인' },
        element: <LoginWithShellPrefetch />,
        errorElement: <RouteErrorFallback />,
    },
    {
        element: (
            <UserGuard>
                <Suspense fallback={<ChunkLoading />}>
                    <UserLayoutLazy />
                </Suspense>
            </UserGuard>
        ),
        // Outlet 안쪽 오류는 레이아웃의 RouteErrorBoundary가 잡는다 —
        // 여기서는 레이아웃 자체의 렌더 오류·lazy import 실패를 최후 방어선으로 받는다 (레이아웃 없이 표시)
        errorElement: <RouteErrorFallback />,
        children: [
            {
                path: '/',
                element: lazyPage(() =>
                    import('@pages/home/HomePage').then((m) => ({ default: m.HomePage })),
                ),
            },
            {
                path: '/time-raffle',
                handle: { title: '겟또타임' },
                element: lazyPage(() =>
                    import('@pages/timeRaffle/TimeRafflePage').then((m) => ({
                        default: m.TimeRafflePage,
                    })),
                ),
            },
            {
                path: '/time-raffle/:id',
                handle: { title: '겟또타임' },
                element: lazyPage(() =>
                    import('@pages/timeRaffleDetail/TimeRaffleDetailPage').then((m) => ({
                        default: m.TimeRaffleDetailPage,
                    })),
                ),
            },
            {
                path: '/events',
                handle: { title: '이벤트' },
                element: lazyPage(() =>
                    import('@pages/eventList/EventListPage').then((m) => ({
                        default: m.EventListPage,
                    })),
                ),
            },
            {
                path: '/events/:id',
                handle: { title: '이벤트' },
                element: lazyPage(() =>
                    import('@pages/eventDetail/EventDetailPage').then((m) => ({
                        default: m.EventDetailPage,
                    })),
                ),
            },
            // 서버 알림 linkUrl이 /events/{id}/results를 쓴다 — 상세가 발표 후 결과를 함께 보여주므로 같은 페이지로 연다
            {
                path: '/events/:id/results',
                handle: { title: '이벤트 결과' },
                element: lazyPage(() =>
                    import('@pages/eventDetail/EventDetailPage').then((m) => ({
                        default: m.EventDetailPage,
                    })),
                ),
            },
            {
                path: '/missions',
                handle: { title: '미션·게임' },
                element: lazyPage(() =>
                    import('@pages/missionList/MissionListPage').then((m) => ({
                        default: m.MissionListPage,
                    })),
                ),
            },
            {
                path: '/missions/:missionId',
                handle: { title: '미션' },
                element: lazyPage(() =>
                    import('@pages/missionDetail/MissionDetailPage').then((m) => ({
                        default: m.MissionDetailPage,
                    })),
                ),
            },
            // 게임 무대는 헤더 바로 아래에 붙는 어두운 띠라 레이아웃의 위 여백을 받지 않는다
            {
                path: '/missions/games/:gameId',
                element: lazyPage(() =>
                    import('@pages/gameDetail/GameDetailPage').then((m) => ({
                        default: m.GameDetailPage,
                    })),
                ),
                handle: { title: '게임', fullBleed: true },
            },
            {
                path: '/my-tickets',
                handle: { title: '내 응모권' },
                element: lazyPage(() =>
                    import('@pages/myTickets/MyTicketsPage').then((m) => ({
                        default: m.MyTicketsPage,
                    })),
                ),
            },
            {
                path: '/my-entries',
                handle: { title: '내 응모 내역' },
                element: lazyPage(() =>
                    import('@pages/myEntries/MyEntriesPage').then((m) => ({
                        default: m.MyEntriesPage,
                    })),
                ),
            },
            {
                path: '/my-notifications',
                handle: { title: '알림' },
                element: lazyPage(() =>
                    import('@pages/myNotifications/MyNotificationsPage').then((m) => ({
                        default: m.MyNotificationsPage,
                    })),
                ),
            },
            {
                path: '/mypage',
                handle: { title: '마이페이지' },
                element: lazyPage(() =>
                    import('@pages/myPage/MyPage').then((m) => ({ default: m.MyPage })),
                ),
            },
            ...(env.isDev
                ? ([
                      {
                          path: '/ui-gallery',
                          handle: { title: 'UI 갤러리' },
                          element: (
                              <Suspense fallback={null}>
                                  <UiGalleryPageLazy />
                              </Suspense>
                          ),
                      },
                  ] satisfies RouteObject[])
                : []),
            // 매칭되지 않는 모든 경로 — 헤더·푸터를 유지한 채 404를 보여준다
            { path: '*', element: <NotFoundPage />, handle: { title: '페이지를 찾을 수 없음' } },
        ],
    },
];
