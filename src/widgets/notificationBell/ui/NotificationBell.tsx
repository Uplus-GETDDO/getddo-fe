import { Bell, ChevronDown, Ellipsis } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

import { useNotificationList } from '@entities/notification';
import {
    useMarkAllNotificationsRead,
    useMarkNotificationRead,
} from '@features/markNotificationRead';
import { useVirtualClock } from '@shared/model/virtualClock';
import { Popover, PopoverContent, PopoverTrigger } from '@shared/ui/popover';

import { groupNotifications } from '../utils/groupNotifications';
import { toInternalPath } from '../utils/toInternalPath';
import { NotificationDrawer } from './NotificationDrawer';
import { NotificationEmpty, NotificationGroupList } from './NotificationGroupList';

const FOCUS =
    'focus-visible:ring-border-focus focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-surface-page focus-visible:outline-none';

/**
 * 헤더 알림 — 피그마 '알림 팝오버 수정안' 기준 (폭 380, 최대 높이 480, 길어지면 목록만 스크롤).
 * 삭제·되돌리기·더보기 메뉴의 삭제는 아직 API가 없어 이 화면에서만 숨긴다 (새로고침하면 다시 보인다)
 */
export function NotificationBell() {
    const { data, fetchNextPage, hasNextPage, isFetchingNextPage } = useNotificationList();
    // 미읽음 전체 수는 로드된 페이지와 무관하게 표시해야 하므로 isRead 필터의 totalElements를 별도 조회한다
    const { data: unreadData } = useNotificationList({ isRead: false, size: 1 });
    const { mutate: markRead } = useMarkNotificationRead();
    const { mutate: markAllRead } = useMarkAllNotificationsRead();
    const navigate = useNavigate();
    // 알림 목록의 상대 시간·'오늘' 묶음 표시 전용이다
    const now = useVirtualClock().now();
    // 화면에서만 지운 알림 id — API 연동 전 임시
    const [hiddenIds, setHiddenIds] = useState<ReadonlySet<string>>(() => new Set());
    const [menuOpen, setMenuOpen] = useState(false);

    const notifications = (data?.pages.flatMap((page) => page.items) ?? []).filter(
        (notification) => !hiddenIds.has(notification.id),
    );
    const unreadCount = unreadData?.pages[0]?.totalElements ?? 0;
    const groups = groupNotifications(notifications, now);

    const hide = (ids: string[], message: string) => {
        if (ids.length === 0) return;
        setHiddenIds((prev) => new Set([...prev, ...ids]));
        toast(message, {
            action: {
                label: '되돌리기',
                onClick: () =>
                    setHiddenIds((prev) => {
                        const next = new Set(prev);
                        ids.forEach((id) => next.delete(id));
                        return next;
                    }),
            },
        });
    };

    const openLink = (linkUrl: string | null) => {
        const path = toInternalPath(linkUrl);
        if (path) void navigate(path);
    };

    return (
        <div className="flex shrink-0 items-center gap-2">
            <Popover>
                <PopoverTrigger
                    aria-label={unreadCount > 0 ? `알림, 읽지 않음 ${unreadCount}개` : '알림'}
                    className={`text-fg-primary relative flex min-h-[44px] min-w-[44px] shrink-0 cursor-pointer items-center justify-center rounded-full ${FOCUS}`}
                >
                    <Bell className="size-6" />
                    {unreadCount > 0 && (
                        <span className="bg-brand-primary border-surface-page absolute -top-0.5 -right-0.5 size-2.5 rounded-full border-2" />
                    )}
                </PopoverTrigger>
                {/* 모바일에서는 화면 폭에서 좌우 16px을 뺀 만큼으로 줄이고, 화면 가장자리와도 16px 띄운다 */}
                <PopoverContent
                    align="end"
                    collisionPadding={16}
                    className="bg-surface-elevated border-border-default flex max-h-120 w-95 max-w-[calc(100vw-2rem)] flex-col gap-0 overflow-hidden rounded-2xl border p-0 shadow-lg ring-0"
                >
                    <div className="flex items-center justify-between pt-4 pr-3 pb-3.5 pl-5">
                        <div className="flex items-center gap-2">
                            <p className="text-subhead text-fg-primary">알림</p>
                            {unreadCount > 0 && (
                                <span className="bg-surface-sunken text-fg-secondary rounded-full px-2 py-0.5 text-sm leading-4 font-semibold tabular-nums">
                                    {unreadCount}
                                </span>
                            )}
                        </div>
                        <div className="flex items-center gap-1">
                            <button
                                type="button"
                                disabled={unreadCount === 0}
                                onClick={() => markAllRead()}
                                className={`text-fg-primary disabled:text-fg-disabled cursor-pointer rounded-sm text-sm leading-[1.375rem] font-normal hover:underline disabled:cursor-not-allowed disabled:no-underline ${FOCUS}`}
                            >
                                모두 읽음
                            </button>
                            <Popover open={menuOpen} onOpenChange={setMenuOpen}>
                                <PopoverTrigger
                                    aria-label="알림 관리"
                                    disabled={notifications.length === 0}
                                    className={`text-fg-secondary hover:bg-surface-sunken disabled:text-fg-disabled flex size-8 cursor-pointer items-center justify-center rounded-full disabled:cursor-not-allowed disabled:bg-transparent ${FOCUS}`}
                                >
                                    <Ellipsis className="size-4" />
                                </PopoverTrigger>
                                <PopoverContent
                                    align="end"
                                    className="bg-surface-elevated border-border-default w-42 gap-0 rounded-xl border px-0 py-1.5 shadow-lg ring-0"
                                >
                                    {[
                                        {
                                            label: '읽은 알림 삭제',
                                            ids: notifications
                                                .filter((n) => n.isRead)
                                                .map((n) => n.id),
                                            message: '읽은 알림을 삭제했어요',
                                        },
                                        {
                                            label: '전체 삭제',
                                            ids: notifications.map((n) => n.id),
                                            message: '알림을 모두 삭제했어요',
                                        },
                                    ].map(({ label, ids, message }) => (
                                        <button
                                            key={label}
                                            type="button"
                                            disabled={ids.length === 0}
                                            onClick={() => {
                                                setMenuOpen(false);
                                                hide(ids, message);
                                            }}
                                            className={`text-body-sm text-fg-primary hover:bg-surface-sunken disabled:text-fg-disabled w-full cursor-pointer px-4 py-2.5 text-left disabled:cursor-not-allowed disabled:bg-transparent ${FOCUS}`}
                                        >
                                            {label}
                                        </button>
                                    ))}
                                </PopoverContent>
                            </Popover>
                        </div>
                    </div>
                    <div className="min-h-0 flex-1 overflow-y-auto">
                        {groups.length === 0 ? (
                            <NotificationEmpty />
                        ) : (
                            <NotificationGroupList
                                groups={groups}
                                now={now}
                                onRead={({ id, linkUrl }) => {
                                    markRead(id);
                                    openLink(linkUrl);
                                }}
                                onDelete={(id) => hide([id], '알림을 삭제했어요')}
                            />
                        )}
                    </div>
                    {hasNextPage && (
                        <>
                            <div className="bg-border-default h-px shrink-0" />
                            <button
                                type="button"
                                onClick={() => void fetchNextPage()}
                                disabled={isFetchingNextPage}
                                className={`text-body-sm-bold text-fg-primary flex shrink-0 cursor-pointer items-center justify-center gap-0.5 py-3.5 hover:underline disabled:cursor-not-allowed ${FOCUS}`}
                            >
                                {isFetchingNextPage ? '불러오는 중…' : '알림 더 보기'}
                                <ChevronDown className="size-4" />
                            </button>
                        </>
                    )}
                </PopoverContent>
            </Popover>
            <NotificationDrawer />
        </div>
    );
}
