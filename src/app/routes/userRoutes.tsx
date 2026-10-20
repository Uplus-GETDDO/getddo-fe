import type { RouteObject } from 'react-router-dom';

import { lazy, Suspense } from 'react';

import { UserLayout } from '@app/layouts/UserLayout';
import { UserGuard } from '@app/routes/UserGuard';
import { EventDetailPage } from '@pages/eventDetail/EventDetailPage';
import { EventListPage } from '@pages/eventList/EventListPage';
import { GameDetailPage } from '@pages/gameDetail/GameDetailPage';
import { HomePage } from '@pages/home/HomePage';
import { LoginPage } from '@pages/login/LoginPage';
import { MissionDetailPage } from '@pages/missionDetail/MissionDetailPage';
import { MissionListPage } from '@pages/missionList/MissionListPage';
import { MyEntriesPage } from '@pages/myEntries/MyEntriesPage';
import { MyNotificationsPage } from '@pages/myNotifications/MyNotificationsPage';
import { MyPage } from '@pages/myPage/MyPage';
import { MyTicketsPage } from '@pages/myTickets/MyTicketsPage';
import { NotFoundPage } from '@pages/notFound/NotFoundPage';
import { TimeRafflePage } from '@pages/timeRaffle/TimeRafflePage';
import { TimeRaffleDetailPage } from '@pages/timeRaffleDetail/TimeRaffleDetailPage';
import { env } from '@shared/config/env';
import { RouteErrorFallback } from '@shared/ui/route-error-boundary';

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
            { path: '/', element: <HomePage /> },
            { path: '/time-raffle', element: <TimeRafflePage /> },
            { path: '/time-raffle/:id', element: <TimeRaffleDetailPage /> },
            { path: '/events', element: <EventListPage /> },
            { path: '/events/:id', element: <EventDetailPage /> },
            { path: '/missions', element: <MissionListPage /> },
            { path: '/missions/:missionId', element: <MissionDetailPage /> },
            // 게임 무대는 헤더 바로 아래에 붙는 어두운 띠라 레이아웃의 위 여백을 받지 않는다
            {
                path: '/missions/games/:gameId',
                element: <GameDetailPage />,
                handle: { fullBleed: true },
            },
            { path: '/my-tickets', element: <MyTicketsPage /> },
            { path: '/my-entries', element: <MyEntriesPage /> },
            { path: '/my-notifications', element: <MyNotificationsPage /> },
            { path: '/mypage', element: <MyPage /> },
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
