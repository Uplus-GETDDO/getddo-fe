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

export interface AdminNavItem {
    to: string;
    label: string;
    icon: LucideIcon;
    /** index 라우트(/admin)는 정확히 일치할 때만 활성화한다 */
    end?: boolean;
}

export const ADMIN_NAV_ITEMS: AdminNavItem[] = [
    { to: '/admin', label: '대시보드', icon: LayoutDashboard, end: true },
    { to: '/admin/users', label: '사용자 조회', icon: UserSearch },
    { to: '/admin/entries', label: '응모 조회', icon: ClipboardList },
    { to: '/admin/events', label: '이벤트 관리', icon: CalendarDays },
    { to: '/admin/draw', label: '추첨 관리', icon: Dices },
    { to: '/admin/tickets', label: '응모권 관리', icon: Ticket },
    { to: '/admin/abuse-cases', label: '어뷰징 차단 내역', icon: ShieldAlert },
    { to: '/admin/notifications', label: '알림 운영', icon: Bell },
    { to: '/admin/banners', label: '배너 관리', icon: Images },
    { to: '/admin/attendance-policies', label: '출석 정책', icon: CalendarDays },
    { to: '/admin/missions', label: '미션 관리', icon: ClipboardList },
    { to: '/admin/virtual-clock', label: '가상 시계', icon: Clock },
    { to: '/admin/virtual-users', label: '가상 사용자', icon: Users },
];
