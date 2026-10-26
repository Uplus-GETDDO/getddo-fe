import type { Notification } from '@entities/notification';

import { NotificationItem } from '@entities/notification';
import { EmptyState } from '@shared/ui/empty-state';

import type { NotificationGroup } from '../utils/groupNotifications';

/** 빈 상태 — 다른 빈 화면과 같은 공용 빈 상태(회색 선 타코야끼). 드로어에서는 남은 높이의 가운데에 선다 */
export function NotificationEmpty() {
    return (
        <EmptyState
            title="새 알림이 없어요"
            description="겟또타임이 열리거나 결과가 발표되면 알려드릴게요."
            className="px-6 py-16"
        />
    );
}

/** 날짜 묶음별 알림 목록 — 헤더 드로어와 알림 페이지(/my-notifications)가 함께 쓴다 */
export function NotificationGroupList({
    groups,
    now,
    onRead,
    onDelete,
    variant = 'drawer',
}: {
    groups: NotificationGroup[];
    now: Date;
    onRead: (notification: Notification) => void;
    onDelete?: (id: string) => void;
    /** 드로어는 맨 위 날짜에 선을 두지 않는다(드로어 머리 선과 겹친다). 페이지는 맨 위에도 선을 둬 묶음 모양을 맞추고, 호버 바탕을 안쪽에 둔다 */
    variant?: 'drawer' | 'page';
}) {
    return groups.map((group, index) => (
        <section key={group.label} aria-label={group.label}>
            {/* 날짜 묶음 머리 — 가운데 날짜, 양옆으로 구분선 (알림 글자 시작선과 같은 좌우 20px 안쪽).
                드로어의 맨 위 묶음은 바로 위에 드로어 머리 선이 있어 선 없이 날짜만 둔다 */}
            <p
                className={`text-caption text-fg-tertiary flex items-center justify-center gap-3 px-5 pt-4 pb-1 ${index > 0 || variant === 'page' ? 'before:bg-border-default after:bg-border-default before:h-px before:flex-1 after:h-px after:flex-1' : ''}`}
            >
                {group.label}
            </p>
            {group.items.map((notification) => (
                <NotificationItem
                    key={notification.id}
                    notification={notification}
                    now={now}
                    onRead={() => onRead(notification)}
                    onDelete={onDelete}
                    inset={variant === 'page'}
                />
            ))}
        </section>
    ));
}
