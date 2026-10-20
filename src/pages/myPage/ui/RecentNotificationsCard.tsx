import { useNavigate } from 'react-router-dom';

import { NotificationItem, useNotificationList } from '@entities/notification';
import { useMarkNotificationRead } from '@features/markNotificationRead';
import { Button } from '@shared/ui/button';
import { RefreshStatus } from '@shared/ui/refresh-status';
import { SkeletonList } from '@shared/ui/skeleton';
import { NOTIFICATIONS_PAGE_PATH, toInternalPath } from '@widgets/notificationBell';

import { SectionCard } from './SectionCard';

/** 미리보기 줄 수 — 나머지는 "전체 보기"(/my-notifications)에서 본다 */
const PREVIEW_COUNT = 3;

/** 마이페이지 "알림" — 최근 알림 몇 개와 전체 알림 페이지로 가는 길 */
export function RecentNotificationsCard({ now }: { now: Date }) {
    const { data, isPending, isError, refetch, isFetching } = useNotificationList();
    const { data: unreadData } = useNotificationList({ isRead: false, size: 1 });
    const { mutate: markRead } = useMarkNotificationRead();
    const navigate = useNavigate();

    const notifications = (data?.pages.flatMap((page) => page.items) ?? []).slice(0, PREVIEW_COUNT);
    const unreadCount = unreadData?.pages[0]?.totalElements ?? 0;

    return (
        <SectionCard
            title="알림"
            description={
                unreadCount > 0
                    ? `읽지 않은 알림이 ${unreadCount}개 있어요.`
                    : '래플 오픈·결과 발표 소식을 모아 둬요.'
            }
            moreTo={NOTIFICATIONS_PAGE_PATH}
            moreLabel="알림 전체 보기"
        >
            {isPending && (
                <div role="status">
                    <span className="sr-only">알림을 불러오는 중</span>
                    <SkeletonList count={PREVIEW_COUNT} rowClassName="h-16" />
                </div>
            )}
            {/* 받아 둔 알림이 있으면 그대로 두고 작은 갱신 실패 표시만 */}
            {isError && data && (
                <RefreshStatus
                    fetching={isFetching}
                    error
                    onRefresh={() => void refetch()}
                    className="-mt-2 self-start"
                />
            )}
            {isError && !data && (
                <div role="alert" className="text-destructive text-body-sm">
                    알림을 불러오지 못했습니다.
                    <Button
                        variant="secondary"
                        disabled={isFetching}
                        onClick={() => void refetch()}
                    >
                        다시 시도
                    </Button>
                </div>
            )}
            {!isPending && data && notifications.length === 0 && (
                <p role="status" className="text-body-sm text-fg-tertiary py-6 text-center">
                    받은 알림이 없어요.
                </p>
            )}
            {notifications.length > 0 && (
                // 알림 줄은 좌우 20px 들임 — 카드 여백(24)과 글자 시작선을 맞춘다
                <div className="-mx-5">
                    {notifications.map((notification) => (
                        <NotificationItem
                            key={notification.id}
                            notification={notification}
                            now={now}
                            // 마이페이지 줄은 응모 내역·응모권 내역처럼 회색 호버 — 연노랑은 알림 드로어·알림 페이지에서만
                            hoverTone="neutral"
                            onRead={() => {
                                markRead(notification.id);
                                const path = toInternalPath(notification.linkUrl);
                                if (path) void navigate(path);
                            }}
                        />
                    ))}
                </div>
            )}
        </SectionCard>
    );
}
