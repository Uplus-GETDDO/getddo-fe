import type { ComponentType } from 'react';
import type { RouteObject } from 'react-router-dom';

import { lazy, Suspense } from 'react';

import { NotFoundPage } from '@pages/notFound/NotFoundPage';
import { env } from '@shared/config/env';
import { RouteErrorFallback } from '@shared/ui/route-error-boundary';

import { AdminGuard } from './AdminGuard';

// 관리자 화면 전체를 lazy로 분리해 유저 번들에 섞이지 않게 한다.
// layout과 각 페이지가 별도 chunk로 나뉘고, 페이지는 AdminLayout 안쪽에서 개별 Suspense를 가진다.
const AdminLayoutLazy = lazy(() =>
    import('@app/layouts/AdminLayout').then((m) => ({ default: m.AdminLayout })),
);

const lazyPage = (importer: () => Promise<{ default: ComponentType }>) => {
    const Page = lazy(importer);
    return (
        <Suspense fallback={null}>
            <Page />
        </Suspense>
    );
};

export const adminRoutes: RouteObject[] = [
    {
        path: '/admin',
        element: (
            <AdminGuard>
                <Suspense fallback={null}>
                    <AdminLayoutLazy />
                </Suspense>
            </AdminGuard>
        ),
        // 레이아웃·가드·lazy 자체가 깨질 때의 최후 방어선 (관리자 셸 없이 표시)
        errorElement: <RouteErrorFallback />,
        children: [
            {
                index: true,
                element: lazyPage(() =>
                    import('@pages/admin/dashboard/AdminDashboardPage').then((m) => ({
                        default: m.AdminDashboardPage,
                    })),
                ),
            },
            {
                path: 'events',
                element: lazyPage(() =>
                    import('@pages/admin/events/AdminEventsPage').then((m) => ({
                        default: m.AdminEventsPage,
                    })),
                ),
                // 상세는 목록 오른쪽 칸(Outlet)에 열린다 — 목록·검색 조건이 그대로 남는다
                children: [
                    {
                        path: ':eventId',
                        element: lazyPage(() =>
                            import('@pages/admin/eventDetail/AdminEventDetailPage').then((m) => ({
                                default: m.AdminEventDetailPage,
                            })),
                        ),
                    },
                ],
            },
            {
                path: 'events/new',
                element: lazyPage(() =>
                    import('@pages/admin/eventForm/AdminEventFormPage').then((m) => ({
                        default: m.AdminEventFormPage,
                    })),
                ),
            },
            {
                path: 'events/:eventId/edit',
                element: lazyPage(() =>
                    import('@pages/admin/eventForm/AdminEventFormPage').then((m) => ({
                        default: m.AdminEventFormPage,
                    })),
                ),
            },
            {
                path: 'draw',
                element: lazyPage(() =>
                    import('@pages/admin/draw/AdminDrawPage').then((m) => ({
                        default: m.AdminDrawPage,
                    })),
                ),
            },
            {
                path: 'abuse-cases',
                element: lazyPage(() =>
                    import('@pages/admin/abuseCases/AdminAbuseCasesPage').then((m) => ({
                        default: m.AdminAbuseCasesPage,
                    })),
                ),
            },
            {
                path: 'users',
                element: lazyPage(() =>
                    import('@pages/admin/users/AdminUsersPage').then((m) => ({
                        default: m.AdminUsersPage,
                    })),
                ),
            },
            {
                path: 'entries',
                element: lazyPage(() =>
                    import('@pages/admin/entries/AdminEntriesPage').then((m) => ({
                        default: m.AdminEntriesPage,
                    })),
                ),
            },
            {
                path: 'tickets',
                element: lazyPage(() =>
                    import('@pages/admin/tickets/AdminTicketsPage').then((m) => ({
                        default: m.AdminTicketsPage,
                    })),
                ),
            },
            {
                path: 'notifications',
                element: lazyPage(() =>
                    import('@pages/admin/notifications/AdminNotificationsPage').then((m) => ({
                        default: m.AdminNotificationsPage,
                    })),
                ),
            },
            {
                path: 'banners',
                element: lazyPage(() =>
                    import('@pages/admin/banners/AdminBannersPage').then((m) => ({
                        default: m.AdminBannersPage,
                    })),
                ),
            },
            {
                path: 'attendance-policies',
                element: lazyPage(() =>
                    import('@pages/admin/attendancePolicies/AdminAttendancePoliciesPage').then(
                        (m) => ({ default: m.AdminAttendancePoliciesPage }),
                    ),
                ),
            },
            {
                path: 'missions',
                element: lazyPage(() =>
                    import('@pages/admin/missions/AdminMissionsPage').then((m) => ({
                        default: m.AdminMissionsPage,
                    })),
                ),
            },
            // 가상 시계는 로컬 개발 전용 표시 도구 — 배포 라우트에는 등록하지 않는다
            ...(env.isDev
                ? [
                      {
                          path: 'virtual-clock',
                          element: lazyPage(() =>
                              import('@pages/admin/virtualClock/AdminVirtualClockPage').then(
                                  (m) => ({ default: m.AdminVirtualClockPage }),
                              ),
                          ),
                      },
                  ]
                : []),
            // 관리자 영역 안의 미매칭 경로 — 관리자 셸을 유지한 채 404를 보여준다.
            // 사용자 라우트도 같은 페이지를 정적 import하므로 lazy 대상이 되지 않아 직접 참조한다
            { path: '*', element: <NotFoundPage /> },
        ],
    },
];
