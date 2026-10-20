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

/** 날짜 묶음별 알림 목록 — 헤더 팝오버와 전체 보기 드로어가 함께 쓴다 */
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
    return groups.map((group) => (
        <section
            key={group.label}
            aria-label={group.label}
            // 날짜 묶음이 바뀌면 좌우 20px 들인 구분선으로 나눈다 (알림 글자 시작선과 맞춤)
            className="[&+&]:before:bg-border-default relative [&+&]:mt-2 [&+&]:before:absolute [&+&]:before:inset-x-5 [&+&]:before:top-0 [&+&]:before:h-px"
        >
            <p className="text-caption text-fg-tertiary px-5 pt-3 pb-0.5">{group.label}</p>
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
