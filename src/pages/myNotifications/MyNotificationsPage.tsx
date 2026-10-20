import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { useNotificationList } from '@entities/notification';
import {
    useMarkAllNotificationsRead,
    useMarkNotificationRead,
} from '@features/markNotificationRead';
import { Button } from '@shared/ui/button';
import { PageHeader } from '@shared/ui/page-header';
import { Segmented } from '@shared/ui/segmented';
import { NotificationPagedList, toInternalPath } from '@widgets/notificationBell';

type ReadFilter = 'ALL' | 'UNREAD';

const READ_OPTIONS = [
    { value: 'ALL', label: '전체' },
    { value: 'UNREAD', label: '읽지 않음' },
] as const;

/** 한 쪽에 담는 알림 수 */
const PAGE_SIZE = 20;

/**
 * 내 알림 — 헤더 드로어의 '모든 알림 보기'와 마이페이지 '알림' 칸이 여는 페이지.
 * 드로어와 같은 날짜 묶음 목록을 마이페이지 하위 페이지 꼴(머리 + 흰 카드)로 넓게 보여주고 번호로 넘긴다
 */
export function MyNotificationsPage() {
    const [filter, setFilter] = useState<ReadFilter>('ALL');
    const { data: unreadData } = useNotificationList({ isRead: false, size: 1 });
    const { mutate: markRead } = useMarkNotificationRead();
    const { mutate: markAllRead, isPending: isMarkingAll } = useMarkAllNotificationsRead();
    const navigate = useNavigate();
    const unreadCount = unreadData?.pages[0]?.totalElements ?? 0;

    return (
        <main className="mx-auto flex w-full max-w-312 flex-col gap-6 px-6 pb-28">
            <PageHeader
                backTo="/mypage"
                backLabel="마이페이지"
                title="알림"
                action={
                    <Button
                        variant="secondary"
                        disabled={unreadCount === 0 || isMarkingAll}
                        onClick={() => markAllRead()}
                    >
                        모두 읽음
                    </Button>
                }
            />

            <section
                aria-label="알림 목록"
                className="bg-surface-page border-border-default flex flex-col gap-2 rounded-2xl border p-6 shadow-md"
            >
                <div className="flex flex-wrap items-center justify-between gap-3 pb-2">
                    <Segmented
                        label="읽음 여부로 거르기"
                        value={filter}
                        options={READ_OPTIONS}
                        onValueChange={setFilter}
                    />
                    <p className="text-body-sm text-fg-secondary tabular-nums">
                        {unreadCount > 0 ? `읽지 않음 ${unreadCount}개` : '모두 읽었어요'}
                    </p>
                </div>

                {/* 목록 줄은 드로어와 같은 좌우 20px 들임 — 카드 여백(24)만큼 당겨 글자 시작선을 제목과 맞춘다 */}
                <div className="-mx-5">
                    <NotificationPagedList
                        isRead={filter === 'UNREAD' ? false : undefined}
                        size={PAGE_SIZE}
                        skeletonCount={5}
                        variant="page"
                        onRead={({ id, linkUrl }) => {
                            markRead(id);
                            const path = toInternalPath(linkUrl);
                            if (path) void navigate(path);
                        }}
                    />
                </div>
            </section>
        </main>
    );
}
