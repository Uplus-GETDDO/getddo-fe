import type { ReactNode } from 'react';

import {
    DetailItem,
    DetailList,
    DetailMeta,
    DetailSection,
    DetailSummary,
} from '@shared/ui/detail-list';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@shared/ui/sheet';
import { formatKst } from '@shared/utils/date';

import type { AdminNotification } from '../model/types';

import { deliveryRetryBlockReason } from '../model/deliveryRetryReason';
import { DeliveryStatusTag } from './NotificationTags';

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
            <SheetContent className="sm:max-w-lg">
                <SheetHeader>
                    <SheetTitle>{notification?.title ?? '발송 상세'}</SheetTitle>
                    <SheetDescription>
                        {notification
                            ? `받는 사람 ${notification.userName ?? notification.userId}`
                            : ''}
                    </SheetDescription>
                </SheetHeader>
                {notification && (
                    <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto px-6 py-5">
                        {/* 핵심 — 발송 상태와 지금 복구할 수 있는지, 실패했다면 왜 */}
                        <DetailSummary>
                            <div className="flex flex-wrap items-center gap-2">
                                <DeliveryStatusTag status={notification.mockDeliveryStatus} />
                                <span className="text-caption text-fg-tertiary">
                                    {notification.isRead ? '읽음' : '읽지 않음'}
                                </span>
                            </div>
                            <p className="text-body-sm text-fg-primary">
                                {notification.mockSentAt
                                    ? `${formatKst(notification.mockSentAt)}에 보냈어요 · ${notification.deliveryAttemptCount}회 시도`
                                    : `아직 보내지 않았어요 · ${notification.deliveryAttemptCount}회 시도`}
                            </p>
                            {notification.lastDeliveryError && (
                                <p className="text-body-sm text-status-rejected-text">
                                    마지막 오류 · {notification.lastDeliveryError}
                                </p>
                            )}
                            {blockReason && (
                                <p className="text-caption text-fg-tertiary">{blockReason}</p>
                            )}
                        </DetailSummary>

                        {action && <div>{action(notification, blockReason)}</div>}

                        <DetailSection title="알림 내용">
                            <div className="border-border-default flex flex-col gap-1 rounded-xl border p-4">
                                <p className="text-body-sm-bold text-fg-primary">
                                    {notification.title}
                                </p>
                                <p className="text-body-sm text-fg-secondary whitespace-pre-wrap">
                                    {notification.body}
                                </p>
                                {notification.linkUrl && (
                                    <p className="text-caption text-fg-tertiary break-all">
                                        {notification.linkUrl}
                                    </p>
                                )}
                            </div>
                        </DetailSection>

                        <DetailSection title="발송">
                            <DetailList>
                                <DetailItem label="생성 시각">
                                    {formatKst(notification.createdAt)}
                                </DetailItem>
                                <DetailItem label="발송 시각">
                                    {kstOrDash(notification.mockSentAt)}
                                </DetailItem>
                                <DetailItem label="다음 재시도">
                                    {kstOrDash(notification.nextDeliveryAttemptAt)}
                                </DetailItem>
                            </DetailList>
                        </DetailSection>

                        <DetailSection title="대상">
                            <DetailList>
                                <DetailItem label="받는 사람">
                                    {notification.userName ?? notification.userId}
                                    {notification.userName && (
                                        <span className="text-caption text-fg-tertiary block">
                                            {notification.userId}
                                        </span>
                                    )}
                                </DetailItem>
                                <DetailItem label="이벤트">
                                    {notification.eventId ?? '-'}
                                </DetailItem>
                                <DetailItem label="작업">{notification.jobId}</DetailItem>
                            </DetailList>
                        </DetailSection>

                        <DetailMeta>알림 ID {notification.id}</DetailMeta>
                    </div>
                )}
            </SheetContent>
        </Sheet>
    );
}
