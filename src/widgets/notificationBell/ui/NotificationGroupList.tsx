import type { Notification } from '@entities/notification';

import { NotificationItem } from '@entities/notification';

import type { NotificationGroup } from '../utils/groupNotifications';

import emptyCharacter from '../assets/empty-character.png';

/** 빈 상태 — 무너 캐릭터와 안내 문구 */
export function NotificationEmpty() {
    return (
        <div className="flex flex-col items-center gap-2 px-6 pt-9 pb-11 text-center">
            <img src={emptyCharacter} alt="" className="size-32 object-contain" />
            <p className="text-body-bold text-fg-primary">새 알림이 없어요</p>
            <p className="text-body-sm text-fg-tertiary">
                래플이 열리거나 결과가 발표되면 알려드릴게요.
            </p>
        </div>
    );
}

/** 날짜 묶음별 알림 목록 — 헤더 드로어와 알림 페이지(/my-notifications)가 함께 쓴다 */
export function NotificationGroupList({
    groups,
    now,
    onRead,
    onDelete,
}: {
    groups: NotificationGroup[];
    now: Date;
    onRead: (notification: Notification) => void;
    onDelete?: (id: string) => void;
}) {
    return groups.map((group, index) => (
        <section key={group.label} aria-label={group.label}>
            {/* 날짜 묶음 머리 — 가운데 날짜, 양옆으로 구분선 (알림 글자 시작선과 같은 좌우 20px 안쪽).
                맨 위 묶음은 위에 나눌 것이 없어 선 없이 날짜만 둔다 */}
            <p
                className={`text-caption text-fg-tertiary flex items-center justify-center gap-3 px-5 pt-4 pb-1 ${index > 0 ? 'before:bg-border-default after:bg-border-default before:h-px before:flex-1 after:h-px after:flex-1' : ''}`}
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
                />
            ))}
        </section>
    ));
}
