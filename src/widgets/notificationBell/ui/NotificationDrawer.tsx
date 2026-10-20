import { List } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { useNotificationList } from '@entities/notification';
import {
    useMarkAllNotificationsRead,
    useMarkNotificationRead,
} from '@features/markNotificationRead';
import { useVirtualClock } from '@shared/model/virtualClock';
import { Button } from '@shared/ui/button';
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
    SheetTrigger,
} from '@shared/ui/sheet';
import { SkeletonList } from '@shared/ui/skeleton';

import { groupNotifications } from '../utils/groupNotifications';
import { toInternalPath } from '../utils/toInternalPath';
import { NotificationEmpty, NotificationGroupList } from './NotificationGroupList';

const FOCUS =
    'focus-visible:ring-border-focus focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-surface-page focus-visible:outline-none';

/**
 * 알림 전체 보기 드로어 — 벨 옆 버튼으로 연다. 목록은 팝오버와 같은 쿼리 훅·항목 UI를 쓰고,
 * "더보기" 커서 페이지네이션이다 (ADR-0009). 알림 삭제·관리는 계약이 없어 제공하지 않는다.
 * 갱신 정책(미확정): 열 때마다 재조회한다 — 본문은 열려 있을 때만 마운트된다
 */
export function NotificationDrawer() {
    const [open, setOpen] = useState(false);

    return (
        <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger
                aria-label="알림 전체 보기"
                className={`text-fg-primary flex min-h-[44px] min-w-[44px] shrink-0 cursor-pointer items-center justify-center rounded-full ${FOCUS}`}
            >
                <List className="size-6" />
            </SheetTrigger>
            <SheetContent className="bg-surface-elevated w-full gap-0 sm:max-w-md">
                <SheetHeader className="pt-4 pr-12 pb-3.5 pl-5">
                    <SheetTitle className="text-subhead text-fg-primary">알림</SheetTitle>
                    <SheetDescription className="sr-only">받은 알림 전체 목록</SheetDescription>
                </SheetHeader>
                <DrawerBody onClose={() => setOpen(false)} />
            </SheetContent>
        </Sheet>
    );
}

function DrawerBody({ onClose }: { onClose: () => void }) {
    const {
        data,
        isPending,
        isError,
        isFetchNextPageError,
        refetch,
        fetchNextPage,
        hasNextPage,
        isFetchingNextPage,
    } = useNotificationList({ refetchOnMount: 'always' });
    const { data: unreadData } = useNotificationList({ isRead: false, size: 1 });
    const { mutate: markRead } = useMarkNotificationRead();
    const { mutate: markAllRead, isPending: isMarkingAll } = useMarkAllNotificationsRead();
    const navigate = useNavigate();
    const now = useVirtualClock().now();

    const notifications = data?.pages.flatMap((page) => page.items) ?? [];
    const unreadCount = unreadData?.pages[0]?.totalElements ?? 0;
    const groups = groupNotifications(notifications, now);

    if (isPending) {
        return (
            <div role="status" className="px-5 py-4">
                <span className="sr-only">알림을 불러오는 중이에요</span>
                <SkeletonList count={4} rowClassName="h-16" />
            </div>
        );
    }
    // 첫 페이지 실패만 전체 오류로 본다 — 이미 받은 목록은 더보기 실패에도 유지한다
    if (isError && !data) {
        return (
            <div role="alert" className="flex flex-col items-center gap-3 px-6 py-10 text-center">
                <p className="text-body-sm text-fg-secondary">알림을 불러오지 못했어요.</p>
                <Button variant="secondary" size="sm" onClick={() => void refetch()}>
                    다시 시도
                </Button>
            </div>
        );
    }

    return (
        <>
            <div className="border-border-default flex items-center justify-between border-b px-5 pb-3">
                <p className="text-body-sm text-fg-secondary">
                    {unreadCount > 0 ? `읽지 않음 ${unreadCount}개` : '모두 읽었어요'}
                </p>
                <button
                    type="button"
                    disabled={unreadCount === 0 || isMarkingAll}
                    onClick={() => markAllRead()}
                    className={`text-fg-primary disabled:text-fg-disabled cursor-pointer rounded-sm text-sm leading-[1.375rem] hover:underline disabled:cursor-not-allowed disabled:no-underline ${FOCUS}`}
                >
                    모두 읽음
                </button>
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
                            const path = toInternalPath(linkUrl);
                            if (path) {
                                onClose();
                                void navigate(path);
                            }
                        }}
                    />
                )}
                {hasNextPage && (
                    <div className="flex flex-col items-center gap-2 py-4">
                        {isFetchNextPageError && (
                            <p role="alert" className="text-body-sm text-fg-secondary">
                                알림을 더 불러오지 못했어요.
                            </p>
                        )}
                        <Button
                            variant="secondary"
                            size="sm"
                            disabled={isFetchingNextPage}
                            onClick={() => void fetchNextPage()}
                        >
                            {isFetchingNextPage ? '불러오는 중…' : '알림 더 보기'}
                        </Button>
                    </div>
                )}
            </div>
        </>
    );
}
