import { House } from 'lucide-react';
import { NavLink, Outlet, ScrollRestoration, useLocation } from 'react-router-dom';

import { VirtualClockTicker } from '@features/controlVirtualClock';
import { RouteErrorBoundary, RouteErrorFallback } from '@shared/ui/route-error-boundary';
import { cn } from '@shared/utils/cn';

import { ADMIN_NAV_ITEMS } from './adminNavItems';

export function AdminLayout() {
    const { pathname } = useLocation();
    const current = ADMIN_NAV_ITEMS.find((item) =>
        item.end
            ? pathname === item.to
            : pathname === item.to || pathname.startsWith(`${item.to}/`),
    );

    return (
        <div className="bg-surface-canvas flex min-h-screen">
            <ScrollRestoration />
            {/* 화면 높이에 고정해 긴 페이지에서도 아래 '사용자 화면으로'가 항상 보이게 한다 — 메뉴가 넘치면 메뉴만 스크롤 */}
            <aside className="border-border bg-surface-inverse sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r md:flex">
                <div className="flex h-16 shrink-0 items-center px-5">
                    {/* 로고를 누르면 대시보드로 */}
                    <NavLink
                        to="/admin"
                        aria-label="관리자 대시보드로 이동"
                        className="text-title-3 text-fg-inverse focus-visible:ring-fg-inverse rounded focus-visible:ring-2 focus-visible:outline-none"
                    >
                        U <span className="text-fg-brand">+</span> GETDDO
                    </NavLink>
                </div>
                {/* 메뉴는 사이드바 폭을 꽉 채운 네모 줄 — 고른 메뉴는 줄 전체가 밝아진다 */}
                <nav className="flex min-h-0 flex-1 flex-col overflow-y-auto py-3">
                    {ADMIN_NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
                        <NavLink
                            key={to}
                            to={to}
                            end={end}
                            className={({ isActive }) =>
                                cn(
                                    'text-subhead focus-visible:ring-fg-inverse flex items-center gap-2.5 px-6 py-3 transition-colors focus-visible:ring-2 focus-visible:outline-none focus-visible:ring-inset',
                                    isActive
                                        ? 'bg-surface-inverse-muted text-fg-inverse'
                                        : 'text-fg-inverse/75 hover:bg-surface-inverse-muted hover:text-fg-inverse',
                                )
                            }
                        >
                            <Icon className="size-4" />
                            {label}
                        </NavLink>
                    ))}
                </nav>
                {/* 사용자 화면으로 — 메뉴와 구분되는 테두리 버튼으로 가운데에 둔다 */}
                <div className="shrink-0 px-4 pt-2 pb-5">
                    <NavLink
                        to="/"
                        className="text-body-sm-bold text-fg-inverse border-fg-inverse/25 hover:bg-surface-inverse-muted focus-visible:ring-fg-inverse flex h-10 items-center justify-center gap-2 rounded-lg border transition-colors focus-visible:ring-2 focus-visible:outline-none"
                    >
                        <House aria-hidden className="size-4" />
                        사용자 화면으로
                    </NavLink>
                </div>
            </aside>
            <div className="flex min-w-0 flex-1 flex-col">
                <header className="border-border bg-surface-elevated flex h-16 items-center border-b px-8">
                    <h1 className="text-title-3">{current?.label ?? '관리자'}</h1>
                    <VirtualClockTicker className="ml-auto hidden md:flex" />
                </header>
                {/* 사이드바가 숨겨지는 md 미만에서는 가로 스크롤 탭으로 같은 이동 경로를 제공한다 */}
                <nav
                    aria-label="관리자 메뉴"
                    className="border-border bg-surface-elevated flex items-center gap-1 overflow-x-auto border-b px-3 py-2 md:hidden"
                >
                    {ADMIN_NAV_ITEMS.map(({ to, label, end }) => (
                        <NavLink
                            key={to}
                            to={to}
                            end={end}
                            className={({ isActive }) =>
                                cn(
                                    'text-body-sm focus-visible:ring-border-focus rounded-lg px-3 py-1.5 whitespace-nowrap transition-colors focus-visible:ring-2 focus-visible:outline-none',
                                    isActive
                                        ? 'bg-surface-inverse text-fg-inverse font-medium'
                                        : 'text-fg-secondary hover:bg-surface-pressed hover:text-fg-primary',
                                )
                            }
                        >
                            {label}
                        </NavLink>
                    ))}
                    <NavLink
                        to="/"
                        className="text-body-sm text-fg-secondary hover:bg-surface-pressed hover:text-fg-primary focus-visible:ring-border-focus ml-auto rounded-lg px-3 py-1.5 whitespace-nowrap transition-colors focus-visible:ring-2 focus-visible:outline-none"
                    >
                        사용자 화면으로
                    </NavLink>
                </nav>
                <main className="flex-1 p-4 md:pt-5 md:pr-0 md:pl-10">
                    {/* 화면 렌더 오류가 나도 사이드바·헤더를 유지하고 라우트 전환으로 복구한다 */}
                    <RouteErrorBoundary resetKey={pathname} fallback={<RouteErrorFallback />}>
                        <Outlet />
                    </RouteErrorBoundary>
                </main>
            </div>
        </div>
    );
}
