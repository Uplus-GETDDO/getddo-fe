import { House } from 'lucide-react';
import { NavLink, Outlet, ScrollRestoration, useLocation } from 'react-router-dom';

import { VirtualClockTicker } from '@features/controlVirtualClock';
import { env } from '@shared/config/env';
import { RouteErrorBoundary, RouteErrorFallback } from '@shared/ui/route-error-boundary';
import { cn } from '@shared/utils/cn';

import { ADMIN_NAV_GROUPS, ADMIN_NAV_ITEMS } from './adminNavItems';
import { useAdminNavBadges } from './useAdminNavBadges';

export function AdminLayout() {
    const { pathname } = useLocation();
    const badges = useAdminNavBadges();
    const current = ADMIN_NAV_ITEMS.find((item) =>
        item.end
            ? pathname === item.to
            : pathname === item.to || pathname.startsWith(`${item.to}/`),
    );

    return (
        <div className="bg-surface-page flex min-h-screen">
            <ScrollRestoration />
            {/*
             * 화면 높이에 고정해 긴 페이지에서도 아래 '사용자 화면으로'가 항상 보이게 한다 — 메뉴가 넘치면 메뉴만 스크롤.
             * 어두운 사이드바는 본문보다 먼저 눈을 끌어 흰 바탕에 묶음 제목을 둔 밝은 메뉴로 바꿨다
             */}
            <aside className="border-border-default bg-surface-page sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r md:flex">
                <div className="flex h-20 shrink-0 items-center px-7">
                    {/* 로고를 누르면 대시보드로 */}
                    <NavLink
                        to="/admin"
                        aria-label="관리자 대시보드로 이동"
                        className="text-fg-primary focus-visible:ring-border-focus flex items-baseline gap-1.5 rounded text-lg font-bold tracking-tight focus-visible:ring-2 focus-visible:outline-none"
                    >
                        <span>
                            U<span className="text-fg-brand">+</span> GETDDO
                        </span>
                        <span className="text-fg-tertiary text-xs font-medium">Admin</span>
                    </NavLink>
                </div>
                <nav className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto px-4 pt-2 pb-4">
                    {ADMIN_NAV_GROUPS.map((group) => {
                        const items = ADMIN_NAV_ITEMS.filter((item) => item.group === group);
                        if (items.length === 0) return null;
                        return (
                            <div key={group} className="flex flex-col gap-0.5">
                                <p className="text-fg-tertiary mb-1.5 px-3 text-[0.6875rem] font-semibold tracking-[0.08em]">
                                    {group}
                                </p>
                                {items.map(({ to, label, icon: Icon, end }) => (
                                    <NavLink
                                        key={to}
                                        to={to}
                                        end={end}
                                        className={({ isActive }) =>
                                            cn(
                                                'focus-visible:ring-border-focus flex h-10 items-center gap-2.5 rounded-lg px-3 text-sm transition-colors focus-visible:ring-2 focus-visible:outline-none',
                                                isActive
                                                    ? 'bg-surface-sunken text-fg-primary font-semibold'
                                                    : 'text-fg-secondary hover:bg-surface-sunken hover:text-fg-primary font-medium',
                                            )
                                        }
                                    >
                                        <Icon aria-hidden className="size-4 shrink-0 opacity-70" />
                                        {label}
                                        {badges[to] && (
                                            <span
                                                title={badges[to].label}
                                                className="bg-brand-primary text-fg-on-brand ml-auto flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-xs font-semibold tabular-nums"
                                            >
                                                <span aria-hidden>{badges[to].count}</span>
                                                <span className="sr-only">{badges[to].label}</span>
                                            </span>
                                        )}
                                    </NavLink>
                                ))}
                            </div>
                        );
                    })}
                </nav>
                {/* 사용자 화면으로 — 메뉴와 구분되는 테두리 버튼 */}
                <div className="shrink-0 px-4 pt-2 pb-5">
                    <NavLink
                        to="/"
                        className="text-body-sm-bold text-fg-secondary border-border-default hover:bg-surface-sunken hover:text-fg-primary focus-visible:ring-border-focus flex h-10 items-center justify-center gap-2 rounded-lg border transition-colors focus-visible:ring-2 focus-visible:outline-none"
                    >
                        <House aria-hidden className="size-4" />
                        사용자 화면으로
                    </NavLink>
                </div>
            </aside>
            <div className="flex min-w-0 flex-1 flex-col">
                {/* 화면 이름은 본문 위에 크게 — 띠 모양 머리줄 대신 바탕 위에 제목만 둔다. 바탕은 흰색 하나로, 칸 구분은 1px 선과 여백으로만 (회색 바탕 위 흰 카드는 화면을 상자투성이로 보이게 했다) */}
                <header className="bg-surface-page flex h-20 items-end px-4 pb-1 md:pr-10 md:pl-10">
                    <h1 className="text-title-2 text-fg-primary">{current?.label ?? '관리자'}</h1>
                    {/* 가상 시계는 로컬 개발 전용 표시 도구다 */}
                    {env.isDev && <VirtualClockTicker className="ml-auto hidden md:flex" />}
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
                            {badges[to] && (
                                <span
                                    title={badges[to].label}
                                    className="text-fg-brand ml-1 font-semibold tabular-nums"
                                >
                                    <span aria-hidden>{badges[to].count}</span>
                                    <span className="sr-only">{badges[to].label}</span>
                                </span>
                            )}
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
