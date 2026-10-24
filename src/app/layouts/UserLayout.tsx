import { ChevronDown, Menu } from 'lucide-react';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { NavLink, Outlet, ScrollRestoration, useLocation, useMatches } from 'react-router-dom';

import { useSessionStore } from '@entities/user';
import { VirtualClockTicker } from '@features/controlVirtualClock';
import { VirtualUserSwitcher } from '@features/switchVirtualUser';
import profileAvatar from '@shared/assets/ui/profile-avatar-head.png';
import { env } from '@shared/config/env';
import { TOUR_TARGET } from '@shared/config/tourTargets';
import { Button } from '@shared/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@shared/ui/popover';
import { RouteErrorBoundary, RouteErrorFallback } from '@shared/ui/route-error-boundary';
import { cn } from '@shared/utils/cn';
import { NotificationBell } from '@widgets/notificationBell';

import { FOOTER_AWARDS, FOOTER_LINKS } from './footerData';
import { USER_NAV_ITEMS } from './userNavItems';

export function UserLayout() {
    const navRef = useRef<HTMLElement>(null);
    const { pathname } = useLocation();
    // 라우트 handle에 fullBleed를 단 화면(게임 무대)은 위 여백 없이 헤더 바로 아래에서 시작한다
    const fullBleed = useMatches().some(
        (match) => (match.handle as { fullBleed?: boolean } | undefined)?.fullBleed,
    );
    // UserGuard가 미선택 상태를 먼저 걸러 주므로 여기서는 항상 있다
    const user = useSessionStore((state) => state.user)!;
    const [indicator, setIndicator] = useState<{ left: number; width: number } | null>(null);
    const [menuOpen, setMenuOpen] = useState(false);
    // 맨 위에서는 피그마처럼 헤더 아래 선 없이, 스크롤하면 연한 그림자로 본문과 구분한다
    const [scrolled, setScrolled] = useState(false);
    useEffect(() => {
        const update = () => setScrolled(window.scrollY > 0);
        update();
        window.addEventListener('scroll', update, { passive: true });
        return () => window.removeEventListener('scroll', update);
    }, []);
    // 모바일 메뉴 — 페이지가 바뀌면 렌더 단계에서 닫는다 (클릭 핸들러보다 전환이 확실하다)
    const [prevPathname, setPrevPathname] = useState(pathname);
    if (prevPathname !== pathname) {
        setPrevPathname(pathname);
        setMenuOpen(false);
    }

    // NavLink가 활성 시 자동으로 붙이는 aria-current="page"로 대상을 찾아 위치를 측정한다
    useLayoutEffect(() => {
        const update = () => {
            const nav = navRef.current;
            const active = nav?.querySelector<HTMLElement>('a[aria-current="page"]');
            if (!nav || !active) {
                setIndicator(null);
                return;
            }
            const navRect = nav.getBoundingClientRect();
            const rect = active.getBoundingClientRect();
            setIndicator({ left: rect.left - navRect.left, width: rect.width });
        };
        update();
        // 창 크기가 그대로여도 메뉴 글자 폭이 바뀌면(큰글씨 모드·글꼴 늦게 도착) 다시 잰다 — 창 resize만 들으면 밑줄이 예전 자리에 남았다
        const observer = new ResizeObserver(update);
        navRef.current?.querySelectorAll('a').forEach((link) => observer.observe(link));
        window.addEventListener('resize', update);
        return () => {
            observer.disconnect();
            window.removeEventListener('resize', update);
        };
    }, [pathname]);

    return (
        <div className="bg-surface-page flex min-h-screen flex-col">
            {/* 라우트가 바뀌면 새 화면은 맨 위에서 시작하고, 뒤로 가기는 이전 위치를 복원한다 */}
            <ScrollRestoration />
            <header
                className={cn(
                    'bg-surface-page sticky top-0 z-30 transition-shadow duration-200',
                    scrolled && 'shadow-md',
                )}
            >
                {/* 피그마 홈 — 높이 76(위아래 20), 로고 24 Bold, 메뉴 16 */}
                <div className="mx-auto flex min-h-19 w-full max-w-312 flex-wrap items-center gap-x-2 gap-y-1 px-3 py-2 sm:gap-x-4 sm:px-6 xl:flex-nowrap xl:gap-x-6">
                    <NavLink
                        to="/"
                        className="text-subhead sm:text-title-2 text-fg-primary shrink-0 whitespace-nowrap"
                    >
                        U<span className="text-fg-brand">+</span> GETDDO
                    </NavLink>
                    <nav
                        ref={navRef}
                        className="relative hidden min-w-0 flex-1 items-stretch gap-4 self-stretch xl:flex"
                    >
                        {USER_NAV_ITEMS.map(({ to, label, end }) => (
                            <NavLink
                                key={label}
                                to={to}
                                end={end}
                                className={({ isActive }) =>
                                    cn(
                                        'text-body-sm relative flex items-center whitespace-nowrap transition-colors',
                                        isActive
                                            ? 'text-fg-primary font-semibold'
                                            : 'text-fg-tertiary hover:text-fg-primary',
                                    )
                                }
                            >
                                {label}
                            </NavLink>
                        ))}
                        {/* 활성 항목 밑줄은 텍스트 바닥과 프레임 하단의 중간 높이(헤더 바닥에서 16)에 두고, 페이지 이동 시 미끄러지게 한다.
                            헤더 줄에 위아래 8px 여백(py-2)이 생겨 nav 바닥도 8px 올라왔으므로 nav 기준으로는 8px만 띄운다 */}
                        <span
                            aria-hidden
                            className="bg-fg-primary pointer-events-none absolute bottom-2 h-0.5 rounded-full transition-all duration-300"
                            style={{
                                left: indicator?.left ?? 0,
                                width: indicator?.width ?? 0,
                                opacity: indicator ? 1 : 0,
                            }}
                        />
                    </nav>
                    {/* nav가 숨겨지는 xl 미만에서는 햄버거 메뉴로 이동 경로를 제공한다 */}
                    <Popover open={menuOpen} onOpenChange={setMenuOpen}>
                        <PopoverTrigger
                            aria-label="메뉴"
                            className="text-fg-primary focus-visible:ring-border-focus focus-visible:ring-offset-surface-page flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-lg focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none xl:hidden"
                        >
                            <Menu className="size-6" />
                        </PopoverTrigger>
                        <PopoverContent align="start" className="w-48 p-1.5">
                            <nav aria-label="모바일 메뉴" className="flex flex-col">
                                {USER_NAV_ITEMS.map(({ to, label, end }) => (
                                    <NavLink
                                        key={label}
                                        to={to}
                                        end={end}
                                        className={({ isActive }) =>
                                            cn(
                                                'text-body-sm rounded-lg px-3 py-2.5 transition-colors',
                                                isActive
                                                    ? 'text-fg-primary font-semibold'
                                                    : 'text-fg-tertiary hover:bg-surface-sunken hover:text-fg-primary',
                                            )
                                        }
                                    >
                                        {label}
                                    </NavLink>
                                ))}
                                {user.role === 'ADMIN' && (
                                    <>
                                        <div
                                            aria-hidden
                                            className="border-border-default my-1 border-t"
                                        />
                                        <NavLink
                                            to="/admin"
                                            className="text-body-sm text-fg-tertiary hover:bg-surface-sunken hover:text-fg-primary rounded-lg px-3 py-2.5 transition-colors"
                                        >
                                            관리자 화면으로
                                        </NavLink>
                                    </>
                                )}
                            </nav>
                        </PopoverContent>
                    </Popover>
                    <div className="ml-auto flex shrink-0 items-center gap-2 sm:gap-3">
                        {/* 관리자 화면 진입은 관리자 계정에게만 보이는 버튼으로만 한다 — 로그인 시 자동 이동 없음 */}
                        {user.role === 'ADMIN' && (
                            <Button
                                variant="secondary"
                                size="sm"
                                asChild
                                className="hidden min-h-[44px] min-w-[44px] xl:inline-flex"
                            >
                                <NavLink to="/admin">관리자 화면으로</NavLink>
                            </Button>
                        )}
                        {/* 가상 시계는 로컬 개발 전용 표시 도구 — 조작은 관리자만, 일반 사용자는 시각 표시만 본다 */}
                        {env.isDev && (
                            <VirtualClockTicker
                                className="hidden 2xl:flex"
                                readOnly={user.role !== 'ADMIN'}
                            />
                        )}
                        {/* 첫 방문 안내가 짚는 자리 — 종 단추만 감싸 밝힌다 */}
                        <div data-tour={TOUR_TARGET.notifications} className="flex">
                            <NotificationBell />
                        </div>
                        {/* 피그마 홈 — 아바타·이름·멤버십 알약(그림자) + 아래 화살표 */}
                        <VirtualUserSwitcher
                            trigger={
                                <button
                                    type="button"
                                    className="bg-surface-page focus-visible:ring-border-focus focus-visible:ring-offset-surface-page flex min-h-[44px] min-w-[44px] shrink-0 cursor-pointer items-center justify-center gap-2 rounded-full p-2 shadow-md focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
                                >
                                    <span className="flex min-w-0 items-center gap-2">
                                        <img
                                            src={profileAvatar}
                                            alt=""
                                            className="size-7 shrink-0 rounded-full"
                                        />
                                        <span className="hidden max-w-28 min-w-0 flex-col items-start sm:flex xl:max-w-32">
                                            <span className="text-fg-primary max-w-full truncate text-xs leading-3.5 font-bold">
                                                {user.name}
                                            </span>
                                            {user.personaLabel && (
                                                <span className="text-fg-tertiary max-w-full truncate text-xs leading-3.5">
                                                    {user.personaLabel}
                                                </span>
                                            )}
                                        </span>
                                    </span>
                                    <ChevronDown
                                        aria-hidden
                                        className="text-fg-tertiary hidden size-4 shrink-0 sm:block"
                                    />
                                </button>
                            }
                        />
                    </div>
                </div>
            </header>
            {/* 모든 화면의 위 여백(헤더 아래 64)을 여기서 한 번만 준다 — 페이지는 위 여백을 따로 두지 않는다 */}
            <div className={fullBleed ? 'flex-1' : 'flex-1 pt-16'}>
                {/* 화면 렌더 오류가 나도 헤더·푸터를 유지하고 라우트 전환으로 복구한다 */}
                <RouteErrorBoundary resetKey={pathname} fallback={<RouteErrorFallback />}>
                    <Outlet />
                </RouteErrorBoundary>
            </div>
            {/* 피그마 홈 푸터 — 약관 줄, 회사 주소, 고객센터·가입문의, 저작권 (글자 12) */}
            <footer className="bg-surface-inverse text-caption">
                <div className="mx-auto flex w-full max-w-312 flex-col gap-10 px-6 pt-12.5 pb-18">
                    <div className="flex flex-col gap-7.5">
                        <p className="text-border-default flex flex-wrap gap-x-1">
                            {FOOTER_LINKS.map(({ label, strong }, index) => (
                                <span key={label} className={strong ? 'font-bold' : undefined}>
                                    {index > 0 && <span className="mr-1 font-medium">|</span>}
                                    {label}
                                </span>
                            ))}
                        </p>
                        <div className="flex flex-col gap-2">
                            <p className="text-fg-tertiary">
                                (주)얻어가유 서울특별시 멀티캠퍼스 선릉위워크
                            </p>
                            <p className="text-fg-tertiary">
                                <span className="text-border-default font-bold">고객센터</span>{' '}
                                1588-0000
                            </p>
                            <p className="text-fg-tertiary">
                                <span className="text-border-default font-bold">가입문의</span>{' '}
                                1588-0000
                            </p>
                            <p className="text-fg-tertiary">
                                Copyright ⓒ U+GETDDO Corp. All Rights Reserved.
                            </p>
                        </div>
                    </div>
                    <ul className="flex flex-wrap items-center gap-x-4 gap-y-3">
                        {FOOTER_AWARDS.map(({ icon, title, detail }) => (
                            <li key={title} className="flex items-center gap-2">
                                <img src={icon} alt="" className="h-10 w-12.5 opacity-80" />
                                <p className="text-fg-tertiary flex flex-col">
                                    <span>{title}</span>
                                    <span>{detail}</span>
                                </p>
                            </li>
                        ))}
                    </ul>
                </div>
            </footer>
        </div>
    );
}
