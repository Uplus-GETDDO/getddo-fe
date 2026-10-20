import { useRef } from 'react';

import type { Notification } from '@entities/notification';

import { useVirtualClock } from '@shared/model/virtualClock';
import { LoadError } from '@shared/ui/load-error';
import { Pagination } from '@shared/ui/pagination';
import { SkeletonList } from '@shared/ui/skeleton';

import { useNotificationPage } from '../hooks/useNotificationPage';
import { groupNotifications } from '../utils/groupNotifications';
import { NotificationEmpty, NotificationGroupList } from './NotificationGroupList';

/**
 * 번호로 넘기는 알림 목록 — 헤더 드로어와 알림 페이지가 함께 쓴다.
 * 한 쪽 안의 알림을 오늘·어제·날짜로 묶어 보이고, 아래 `< 1 2 3 >`로 넘긴다
 */
export function NotificationPagedList({
    isRead,
    size,
    refetchOnMount,
    onRead,
    skeletonCount = 4,
    variant = 'drawer',
}: {
    isRead?: boolean;
    size: number;
    refetchOnMount?: 'always';
    onRead: (notification: Notification) => void;
    skeletonCount?: number;
    variant?: 'drawer' | 'page';
}) {
    const { query, page, totalPages, setPage, items, pageLoading, pageError, retryPage } =
        useNotificationPage({ isRead, size, refetchOnMount });
    // 알림 시각의 '오늘·어제' 묶음과 상대 시간 표시 전용이다
    const now = useVirtualClock().now();
    const topRef = useRef<HTMLDivElement>(null);

    if (query.isPending) {
        return (
            <div role="status" className="px-5 py-4">
                <span className="sr-only">알림을 불러오는 중이에요</span>
                <SkeletonList count={skeletonCount} rowClassName="h-16" />
            </div>
        );
    }
    // 첫 쪽 실패만 전체 오류로 본다 — 받아 둔 쪽은 다른 쪽 실패에도 유지한다
    if (query.isError && !query.data) {
        return (
            <LoadError
                title="알림을 불러오지 못했어요"
                onRetry={() => void query.refetch()}
                retrying={query.isFetching}
                className="px-5 py-6"
            />
        );
    }

    const changePage = (next: number) => {
        setPage(next);
        // 새 쪽은 맨 위부터 읽게 목록 머리로 올린다
        topRef.current?.scrollIntoView?.({ block: 'nearest' });
    };

    return (
        <div ref={topRef} className="flex flex-col">
            {pageLoading ? (
                <div role="status" className="px-5 py-4">
                    <span className="sr-only">알림을 불러오는 중이에요</span>
                    <SkeletonList count={skeletonCount} rowClassName="h-16" />
                </div>
            ) : pageError ? (
                <LoadError
                    title={`${page}쪽 알림을 불러오지 못했어요`}
                    onRetry={retryPage}
                    className="px-5 py-6"
                />
            ) : !items || items.length === 0 ? (
                <NotificationEmpty />
            ) : (
                <NotificationGroupList
                    groups={groupNotifications(items, now)}
                    now={now}
                    onRead={onRead}
                    variant={variant}
                />
            )}
            {totalPages > 1 && (
                <Pagination
                    page={page}
                    totalPages={totalPages}
                    onPageChange={changePage}
                    className="justify-center py-4"
                />
            )}
        </div>
    );
}
