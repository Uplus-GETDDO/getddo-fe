export interface UserNavItem {
    to: string;
    label: string;
    /** index 라우트(/)는 정확히 일치할 때만 활성화한다 */
    end?: boolean;
}

export const USER_NAV_ITEMS: UserNavItem[] = [
    { to: '/', label: '홈', end: true },
    { to: '/time-raffle', label: '겟또타임' },
    { to: '/events', label: '이벤트' },
    { to: '/missions', label: '미션·게임' },
    { to: '/mypage', label: '마이페이지' },
];
