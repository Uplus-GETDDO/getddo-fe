import type { LucideIcon } from 'lucide-react';

import {
    Bell,
    CalendarDays,
    ClipboardList,
    Clock,
    Dices,
    Images,
    LayoutDashboard,
    ShieldAlert,
    Ticket,
    UserSearch,
    Users,
} from 'lucide-react';

import { env } from '@shared/config/env';

export interface AdminNavItem {
    to: string;
    label: string;
    icon: LucideIcon;
    /** index 라우트(/admin)는 정확히 일치할 때만 활성화한다 */
    end?: boolean;
    /** 사이드바 묶음 — 메뉴 열네 개를 한 줄로 늘어놓으면 어디부터 봐야 할지 몰랐다 */
    group: AdminNavGroup;
}

export const ADMIN_NAV_GROUPS = ['운영', '리워드', '콘텐츠', '보호', '도구'] as const;
export type AdminNavGroup = (typeof ADMIN_NAV_GROUPS)[number];

export const ADMIN_NAV_ITEMS: AdminNavItem[] = [
    { to: '/admin', label: '대시보드', icon: LayoutDashboard, group: '운영', end: true },
    { to: '/admin/users', label: '사용자 조회', icon: UserSearch, group: '운영' },
    { to: '/admin/entries', label: '응모 조회', icon: ClipboardList, group: '운영' },
    { to: '/admin/events', label: '이벤트 관리', icon: CalendarDays, group: '운영' },
    { to: '/admin/draw', label: '추첨 관리', icon: Dices, group: '운영' },
    { to: '/admin/tickets', label: '응모권 관리', icon: Ticket, group: '리워드' },
    { to: '/admin/abuse-cases', label: '어뷰징 차단 내역', icon: ShieldAlert, group: '보호' },
    { to: '/admin/notifications', label: '알림 운영', icon: Bell, group: '콘텐츠' },
    { to: '/admin/banners', label: '배너 관리', icon: Images, group: '콘텐츠' },
    { to: '/admin/attendance-policies', label: '출석 정책', icon: CalendarDays, group: '리워드' },
    { to: '/admin/missions', label: '미션 관리', icon: ClipboardList, group: '리워드' },
    // 가상 시계는 로컬 개발 전용 — 배포에서는 메뉴·라우트를 등록하지 않는다
    ...(env.isDev
        ? [{ to: '/admin/virtual-clock', label: '가상 시계', icon: Clock, group: '도구' as const }]
        : []),
    { to: '/admin/virtual-users', label: '가상 사용자', icon: Users, group: '도구' },
];
