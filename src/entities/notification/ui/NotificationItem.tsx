import { ChevronRight, X } from 'lucide-react';

import { Button } from '@shared/ui/button';
import { formatRelativeFromNow } from '@shared/utils/date';

import type { Notification } from '../model/types';

const FOCUS =
    'focus-visible:ring-border-focus focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-surface-page focus-visible:outline-none';

/**
 * 알림 한 줄 — 피그마 '알림 팝오버 수정안' 기준.
 * 왼쪽 8px 칸에 읽지 않음 점(잉크), 제목 1줄·본문 2줄 말줄임, 호버하면 연노랑 배경과 오른쪽 위 삭제(X) 버튼.
 * 읽지 않은 알림은 제목을 SemiBold 잉크로, 읽은 알림은 Regular 보조색으로 한 단계 낮춘다.
 * 이동할 곳(linkUrl)이 있는 알림은 시간 위에 "결과 확인하기 ›"(발표 알림)·"바로 가기 ›"를 둬 누르면 이동한다는 걸 보여 준다.
 * 결과 발표 알림은 당첨·낙첨을 쓰지 않고 결과 화면으로 안내만 한다 (getddo-spec 02-domain/notification.md 결과 발표 알림)
 */
export function NotificationItem({
    notification,
    now,
    onRead,
    onDelete,
    hoverTone = 'accent',
}: {
    notification: Notification;
    now: Date;
    onRead?: (id: string, linkUrl: string | null) => void;
    onDelete?: (id: string) => void;
    /** 호버 배경 — 알림 드로어·페이지는 연노랑(accent), 다른 목록과 섞이는 마이페이지는 회색(neutral) */
    hoverTone?: 'accent' | 'neutral';
}) {
    const unread = !notification.isRead;
    return (
        <div
            className={`group relative flex items-start gap-3 py-3.5 pr-4 pl-5 motion-safe:transition-colors ${hoverTone === 'accent' ? 'hover:bg-ticket-accent focus-within:bg-ticket-accent' : 'hover:bg-surface-canvas focus-within:bg-surface-canvas rounded-xl'}`}
        >
            {/* 읽지 않음 점 — 제목 첫 줄 가운데에 맞춘다. 읽은 알림도 칸은 남겨 글자 시작선을 맞춘다 */}
            <span aria-hidden className="flex h-5.5 w-2 shrink-0 items-center justify-center">
                {unread && <span className="bg-fg-primary size-1.5 rounded-full" />}
            </span>
            <div className="flex min-w-0 flex-1 flex-col items-start gap-1">
                <button
                    type="button"
                    onClick={() => onRead?.(notification.id, notification.linkUrl)}
                    className={`flex w-full flex-col gap-1 rounded-sm text-left ${FOCUS}`}
                >
                    {/* 삭제(X) 버튼은 제목 줄 오른쪽에만 뜨므로 그 자리(24+여유)는 제목 줄에서만 비워 두고, 본문·시간은 끝까지 쓴다 */}
                    <span className="flex w-full items-center pr-7">
                        <span
                            className={`min-w-0 flex-1 truncate ${unread ? 'text-body-sm-bold text-fg-primary' : 'text-body-sm text-fg-secondary'}`}
                        >
                            {unread && <span className="sr-only">읽지 않음 </span>}
                            {notification.title}
                        </span>
                    </span>
                    <span className="text-body-sm text-fg-secondary line-clamp-2 break-keep">
                        {notification.body}
                    </span>
                    {notification.linkUrl && (
                        <span className="text-caption text-fg-primary inline-flex items-center gap-0.5 font-semibold">
                            {/발표|결과/.test(notification.title) ? '결과 확인하기' : '바로 가기'}
                            <ChevronRight aria-hidden className="size-3.5" />
                        </span>
                    )}
                    <span className="text-caption text-fg-tertiary">
                        {formatRelativeFromNow(notification.createdAt, now)}
                    </span>
                </button>
            </div>
            {onDelete && (
                // 마우스를 올리거나 키보드로 들어오면 보이는 삭제 버튼 — 공용 모달 닫기(X)와 같은 모양.
                // 숨겨진 동안은 클릭도 받지 않아, 터치 화면에서 알림 우상단을 눌러도 알림이 열린다
                <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`${notification.title} 알림 삭제`}
                    onClick={() => onDelete(notification.id)}
                    className="text-fg-secondary hover:text-fg-primary pointer-events-none absolute top-2.5 right-3 cursor-pointer opacity-0 group-focus-within:pointer-events-auto group-focus-within:opacity-100 group-hover:pointer-events-auto group-hover:opacity-100 hover:bg-transparent dark:hover:bg-transparent"
                >
                    <X />
                </Button>
            )}
        </div>
    );
}
