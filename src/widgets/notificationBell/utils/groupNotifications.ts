import type { Notification } from '@entities/notification';

import { formatKst, kstDayDiff, toKst } from '@shared/utils/date';

export type NotificationGroup = { label: string; items: Notification[] };

/** 묶음 이름 — 오늘·어제, 그 전은 '10월 3일 (금)', 올해가 아니면 '2025년 10월 3일 (금)' */
function dayLabel(createdAt: string, now: Date): string {
    const diff = kstDayDiff(createdAt, now);
    if (diff >= 0) return '오늘';
    if (diff === -1) return '어제';
    // 요일은 따로 받아 괄호로 붙인다 — 한 번에 받으면 브라우저마다 '10월 3일 금'처럼 꼴이 달랐다
    const weekday = formatKst(createdAt, { weekday: 'short' });
    const year = toKst(createdAt).getUTCFullYear();
    // 다른 해의 같은 날짜가 한 묶음으로 섞이지 않고, 몇 년 전 알림인지도 보이게 해를 붙인다
    const prefix = year === toKst(now).getUTCFullYear() ? '' : `${year}년 `;
    return `${prefix}${formatKst(createdAt, { month: 'long', day: 'numeric' })} (${weekday})`;
}

/**
 * 알림을 KST 날짜별로 묶는다 — 오늘·어제·날짜. 받은 순서(최신순)를 유지하고, 같은 날짜는 한 묶음이다.
 * 예전 '오늘/이전' 두 묶음은 이전이 너무 길어 언제 받은 알림인지 알기 어려웠다
 */
export function groupNotifications(notifications: Notification[], now: Date): NotificationGroup[] {
    const groups = new Map<string, Notification[]>();
    for (const notification of notifications) {
        const label = dayLabel(notification.createdAt, now);
        const items = groups.get(label);
        if (items) items.push(notification);
        else groups.set(label, [notification]);
    }
    return [...groups].map(([label, items]) => ({ label, items }));
}
