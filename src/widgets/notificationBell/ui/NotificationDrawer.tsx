import { Bell, ChevronRight } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { useNotificationList } from '@entities/notification';
import {
    useMarkAllNotificationsRead,
    useMarkNotificationRead,
} from '@features/markNotificationRead';
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
    SheetTrigger,
} from '@shared/ui/sheet';

import { toInternalPath } from '../utils/toInternalPath';
import { NotificationPagedList } from './NotificationPagedList';

const FOCUS =
    'focus-visible:ring-border-focus focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-surface-page focus-visible:outline-none';

/** 마이페이지의 알림 전체 페이지 — 드로어 아래 '모든 알림 보기'가 연다 */
export const NOTIFICATIONS_PAGE_PATH = '/my-notifications';

/**
 * 헤더 알림 — 종 버튼 하나가 오른쪽 드로어를 연다. 팝오버와 전체 보기 버튼이 따로 있어 헷갈려 드로어 하나로 합쳤다.
 * 목록은 번호 페이지로 넘긴다 — 서버 커서(ADR-0009)를 차례로 따라가 쪽을 만든다. 알림 삭제·관리는 계약이 없어 제공하지 않는다.
 * 갱신 정책(미확정): 열 때마다 재조회한다 — 본문은 열려 있을 때만 마운트된다
 */
export function NotificationDrawer() {
    const [open, setOpen] = useState(false);
    // 미읽음 전체 수는 로드된 페이지와 무관하게 표시해야 하므로 isRead 필터의 totalElements를 별도 조회한다
    const { data: unreadData } = useNotificationList({ isRead: false, size: 1 });
    const unreadCount = unreadData?.pages[0]?.totalElements ?? 0;
    const { mutate: markAllRead, isPending: isMarkingAll } = useMarkAllNotificationsRead();

    return (
        <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger
                aria-label={unreadCount > 0 ? `알림, 읽지 않음 ${unreadCount}개` : '알림'}
                className={`text-fg-primary flex min-h-[44px] min-w-[44px] shrink-0 cursor-pointer items-center justify-center rounded-full ${FOCUS}`}
            >
                {/* 점은 44px 누름 칸이 아니라 종 그림 어깨에 걸친다 — 칸 모서리에 두면 종과 멀어 보였다 */}
                <span className="relative">
                    <Bell className="size-6" />
                    {unreadCount > 0 && (
                        <span className="bg-brand-primary border-surface-page absolute -top-px right-0.5 size-2.5 rounded-full border-2" />
                    )}
                </span>
            </SheetTrigger>
            <SheetContent className="bg-surface-elevated w-full gap-0 sm:max-w-md">
                {/*
                 * 머리 한 줄 — 제목 옆에 읽지 않은 수, 오른쪽(닫기 옆)에 '모두 읽음'. 예전에는 머리 아래 '모두 읽었어요' 줄을
                 * 따로 두어 선이 두 겹으로 지고, 다 읽은 뒤에도 흐린 버튼이 남아 어색했다 — 읽을 게 없으면 버튼을 감춘다
                 */}
                <SheetHeader className="flex-row items-center gap-2 pt-4 pr-14 pb-3.5 pl-5">
                    <SheetTitle className="text-subhead text-fg-primary">알림</SheetTitle>
                    {unreadCount > 0 && (
                        <span className="bg-brand-primary text-fg-on-brand flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-xs font-semibold tabular-nums">
                            <span aria-hidden>{unreadCount}</span>
                            <span className="sr-only">읽지 않음 {unreadCount}개</span>
                        </span>
                    )}
                    <SheetDescription className="sr-only">받은 알림 전체 목록</SheetDescription>
                    {unreadCount > 0 && (
                        <button
                            type="button"
                            disabled={isMarkingAll}
                            onClick={() => markAllRead()}
                            // 글줄(22px) 위아래로 누름 칸을 24px(WCAG 2.5.8)까지 넓히고 음수 마진으로 줄간격을 지킨다
                            className={`text-fg-secondary hover:text-fg-primary disabled:text-fg-disabled -my-0.5 ml-auto cursor-pointer rounded-sm py-0.5 text-sm leading-[1.375rem] disabled:cursor-not-allowed ${FOCUS}`}
                        >
                            모두 읽음
                        </button>
                    )}
                </SheetHeader>
                <DrawerBody onClose={() => setOpen(false)} />
                {/* 지난 알림까지 넓게 보는 곳은 마이페이지 — 목록을 못 불러와도 갈 수 있게 본문 밖 바닥에 둔다. 드로어는 닫고 넘어간다 */}
                <Link
                    to={NOTIFICATIONS_PAGE_PATH}
                    onClick={() => setOpen(false)}
                    className={`border-border-default text-body-sm-bold text-fg-primary hover:bg-surface-sunken mt-auto flex shrink-0 items-center justify-center gap-0.5 border-t py-4 ${FOCUS}`}
                >
                    모든 알림 보기
                    <ChevronRight aria-hidden className="size-4" />
                </Link>
            </SheetContent>
        </Sheet>
    );
}

/** 드로어 한 쪽에 담는 알림 수 — 좁은 칸이라 페이지보다 적게 */
const DRAWER_PAGE_SIZE = 10;

function DrawerBody({ onClose }: { onClose: () => void }) {
    const { mutate: markRead } = useMarkNotificationRead();
    const navigate = useNavigate();

    return (
        <>
            <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
                <NotificationPagedList
                    size={DRAWER_PAGE_SIZE}
                    refetchOnMount="always"
                    onRead={({ id, linkUrl }) => {
                        markRead(id);
                        const path = toInternalPath(linkUrl);
                        if (path) {
                            onClose();
                            void navigate(path);
                        }
                    }}
                />
            </div>
        </>
    );
}
