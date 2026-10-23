import type { ComponentType } from 'react';
import type { RouteObject } from 'react-router-dom';

import { lazy, Suspense } from 'react';

import { UserLayout } from '@app/layouts/UserLayout';
import { UserGuard } from '@app/routes/UserGuard';
import { LoginPage } from '@pages/login/LoginPage';
import { NotFoundPage } from '@pages/notFound/NotFoundPage';
import { env } from '@shared/config/env';
import { RouteErrorFallback } from '@shared/ui/route-error-boundary';
import { SkeletonDetail } from '@shared/ui/skeleton';

// 관리자 경로와 같은 로딩 경계를 페이지에 둔다. 청크를 받는 동안 사용자 셸을 유지한다.
const lazyPage = (importer: () => Promise<{ default: ComponentType }>) => {
    const Page = lazy(importer);
    return (
        <Suspense fallback={<SkeletonDetail />}>
            <Page />
        </Suspense>
    );
};

// 디자인 갤러리는 개발용 화면 — 운영 빌드에서는 라우트 자체를 등록하지 않는다
const UiGalleryPageLazy = lazy(() =>
    import('@pages/uiGallery/UiGalleryPage').then((m) => ({ default: m.UiGalleryPage })),
);

export const userRoutes: RouteObject[] = [
    { path: '/login', element: <LoginPage />, errorElement: <RouteErrorFallback /> },
    {
        element: (
            <UserGuard>
                <UserLayout />
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
                element: lazyPage(() =>
                    import('@pages/timeRaffle/TimeRafflePage').then((m) => ({
                        default: m.TimeRafflePage,
                    })),
                ),
            },
            {
                path: '/time-raffle/:id',
                element: lazyPage(() =>
                    import('@pages/timeRaffleDetail/TimeRaffleDetailPage').then((m) => ({
                        default: m.TimeRaffleDetailPage,
                    })),
                ),
            },
            {
                path: '/events',
                element: lazyPage(() =>
                    import('@pages/eventList/EventListPage').then((m) => ({
                        default: m.EventListPage,
                    })),
                ),
            },
            {
                path: '/events/:id',
                element: lazyPage(() =>
                    import('@pages/eventDetail/EventDetailPage').then((m) => ({
                        default: m.EventDetailPage,
                    })),
                ),
            },
            // 서버 알림 linkUrl이 /events/{id}/results를 쓴다 — 상세가 발표 후 결과를 함께 보여주므로 같은 페이지로 연다
            {
                path: '/events/:id/results',
                element: lazyPage(() =>
                    import('@pages/eventDetail/EventDetailPage').then((m) => ({
                        default: m.EventDetailPage,
                    })),
                ),
            },
            {
                path: '/missions',
                element: lazyPage(() =>
                    import('@pages/missionList/MissionListPage').then((m) => ({
                        default: m.MissionListPage,
                    })),
                ),
            },
            {
                path: '/missions/:missionId',
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
                handle: { fullBleed: true },
            },
            {
                path: '/my-tickets',
                element: lazyPage(() =>
                    import('@pages/myTickets/MyTicketsPage').then((m) => ({
                        default: m.MyTicketsPage,
                    })),
                ),
            },
            {
                path: '/my-entries',
                element: lazyPage(() =>
                    import('@pages/myEntries/MyEntriesPage').then((m) => ({
                        default: m.MyEntriesPage,
                    })),
                ),
            },
            {
                path: '/my-notifications',
                element: lazyPage(() =>
                    import('@pages/myNotifications/MyNotificationsPage').then((m) => ({
                        default: m.MyNotificationsPage,
                    })),
                ),
            },
            {
                path: '/mypage',
                element: lazyPage(() =>
                    import('@pages/myPage/MyPage').then((m) => ({ default: m.MyPage })),
                ),
            },
            ...(env.isDev
                ? ([
                      {
                          path: '/ui-gallery',
                          element: (
                              <Suspense fallback={null}>
                                  <UiGalleryPageLazy />
                              </Suspense>
                          ),
                      },
                  ] satisfies RouteObject[])
                : []),
            // 매칭되지 않는 모든 경로 — 헤더·푸터를 유지한 채 404를 보여준다
            { path: '*', element: <NotFoundPage /> },
        ],
    },
];
