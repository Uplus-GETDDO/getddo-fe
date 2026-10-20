import type { Notification } from '@entities/notification';

import { isSameKstDate } from '@shared/utils/date';

export type NotificationGroup = { label: '오늘' | '이전'; items: Notification[] };

/** 알림을 KST 날짜 기준 '오늘'과 '이전'으로 나눈다 (피그마 알림 팝오버 수정안). 빈 묶음은 뺀다 */
export function groupNotifications(notifications: Notification[], now: Date): NotificationGroup[] {
    const today = notifications.filter((n) => isSameKstDate(n.createdAt, now));
    const earlier = notifications.filter((n) => !isSameKstDate(n.createdAt, now));
    const groups: NotificationGroup[] = [
        { label: '오늘', items: today },
        { label: '이전', items: earlier },
    ];
    return groups.filter((group) => group.items.length > 0);
}
