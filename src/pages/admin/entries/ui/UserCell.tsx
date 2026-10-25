import { Link } from 'react-router-dom';

import { Popover, PopoverContent, PopoverTrigger } from '@shared/ui/popover';

const MENU_ITEM =
    'text-body-sm text-fg-primary hover:bg-surface-sunken focus-visible:bg-surface-sunken flex items-center justify-between rounded-md px-3 py-2 outline-none';

/**
 * 사용자 칸 — 이름을 진하게, ID는 아래 작은 글로. 이름이 없으면 ID를 보인다 (ADR-028).
 * 이름을 누르면 바로 다른 화면으로 넘어가지 않고 갈 곳을 고르는 작은 메뉴가 뜬다 — 응모를 보던 흐름에서는
 * '이 사람 응모만 걸러 보기'가 가장 흔해, 맨 위에 두고 지금 화면에 그대로 머문다
 */
export function UserCell({ userId, userName }: { userId: string; userName?: string | null }) {
    return (
        <>
            <Popover>
                <PopoverTrigger className="text-body-sm-bold text-fg-primary hover:text-fg-brand focus-visible:ring-border-focus cursor-pointer rounded-sm text-left hover:underline focus-visible:ring-2 focus-visible:outline-none">
                    {userName ?? userId}
                </PopoverTrigger>
                <PopoverContent align="start" className="w-52 gap-0 p-1.5">
                    <Link className={MENU_ITEM} to={`/admin/entries?userId=${userId}`}>
                        이 사용자 응모만 보기
                    </Link>
                    <Link className={MENU_ITEM} to={`/admin/tickets?userId=${userId}`}>
                        응모권 이력 보기
                        <span aria-hidden>→</span>
                    </Link>
                    <Link className={MENU_ITEM} to={`/admin/users?detail=${userId}`}>
                        사용자 상세 열기
                        <span aria-hidden>→</span>
                    </Link>
                </PopoverContent>
            </Popover>
            {userName && <span className="text-caption text-fg-tertiary block">{userId}</span>}
        </>
    );
}
