import type { ReactNode } from 'react';

import { badgeVariants } from '@shared/ui/badge';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@shared/ui/sheet';
import { cn } from '@shared/utils/cn';
import { formatKst } from '@shared/utils/date';

import type { AdminNotification, MockDeliveryStatus } from '../model/types';

import { deliveryRetryBlockReason } from '../model/deliveryRetryReason';
import { MOCK_DELIVERY_STATUS_LABEL } from '../model/types';

const FIELD = 'text-caption text-fg-tertiary';
const VALUE = 'text-body-sm text-fg-primary break-all';
// 상태·분류 칩 — 사용자 화면과 같은 공용 배지 모양(둥근 알약, 높이 26·글자 12)에 색만 칩마다 입힌다
const CHIP = badgeVariants({ variant: null });

const STATUS_CHIP: Record<MockDeliveryStatus, string> = {
    PENDING: 'bg-status-revision text-status-revision-text',
    SENT: 'bg-status-approved text-status-approved-text',
    FAILED: 'bg-status-rejected text-status-rejected-text',
};

function Field({ label, children }: { label: string; children: ReactNode }) {
    return (
        <div className="flex flex-col gap-1">
            <span className={FIELD}>{label}</span>
            <span className={VALUE}>{children}</span>
        </div>
    );
}

const kstOrDash = (iso: string | null) => (iso ? formatKst(iso) : '-');

/**
 * 개별 알림 모의 발송 진단 드로어 — AN04 목록 응답 필드만으로 구성한다.
 * 별도의 발송 상세 API가 없어 마지막 오류·다음 재시도·발송 차수·내용을 여기서 확인한다.
 * 복구 재시도 같은 사용자 행동은 페이지가 action 슬롯으로 주입한다.
 */
export function AdminNotificationDetailDrawer({
    notification,
    open,
    onOpenChange,
    action,
}: {
    notification: AdminNotification | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    /** 발송 복구 버튼 등 행동 슬롯 — 현재 대상과 복구 불가 사유를 인자로 받는다 */
    action?: (notification: AdminNotification, blockReason: string | null) => ReactNode;
}) {
    const blockReason = notification ? deliveryRetryBlockReason(notification) : null;

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent className="overflow-y-auto sm:max-w-md">
                <SheetHeader>
                    <SheetTitle>발송 상세</SheetTitle>
                    <SheetDescription>{notification ? notification.id : ''}</SheetDescription>
                </SheetHeader>
                {notification && (
                    <div className="flex flex-col gap-4 px-4 pb-6">
                        <Field label="알림 제목">{notification.title}</Field>
                        <Field label="알림 내용">{notification.body}</Field>
                        <Field label="발송 상태">
                            <span
                                className={cn(CHIP, STATUS_CHIP[notification.mockDeliveryStatus])}
                            >
                                {MOCK_DELIVERY_STATUS_LABEL[notification.mockDeliveryStatus]}
                            </span>
                        </Field>
                        <Field label="읽음">{notification.isRead ? '읽음' : '읽지 않음'}</Field>
                        <Field label="사용자">
                            {notification.userName
                                ? `${notification.userName} (${notification.userId})`
                                : notification.userId}
                        </Field>
                        <Field label="작업">{notification.jobId}</Field>
                        <Field label="이벤트">{notification.eventId ?? '-'}</Field>
                        <Field label="발송 차수">{notification.deliveryAttemptCount}회</Field>
                        <Field label="생성 시각">{formatKst(notification.createdAt)}</Field>
                        <Field label="발송 시각">{kstOrDash(notification.mockSentAt)}</Field>
                        <Field label="다음 자동 재시도">
                            {kstOrDash(notification.nextDeliveryAttemptAt)}
                        </Field>
                        <Field label="마지막 오류">{notification.lastDeliveryError ?? '-'}</Field>
                        <Field label="연결 링크">{notification.linkUrl ?? '-'}</Field>
                        <Field label="복구 가능">
                            {notification.retryable ? '가능' : `불가 — ${blockReason}`}
                        </Field>
                        {action?.(notification, blockReason)}
                    </div>
                )}
            </SheetContent>
        </Sheet>
    );
}
