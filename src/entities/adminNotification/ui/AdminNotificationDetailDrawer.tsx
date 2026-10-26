import type { ReactNode } from 'react';

import {
    DetailItem,
    DetailList,
    DetailMeta,
    DetailSection,
    DetailSummary,
} from '@shared/ui/detail-list';
import {
    InspectorBody,
    InspectorDescription,
    InspectorHeader,
    InspectorPanel,
    InspectorTitle,
} from '@shared/ui/inspector';
import { formatKst } from '@shared/utils/date';

import type { AdminNotification } from '../model/types';

import { deliveryRetryBlockReason } from '../model/deliveryRetryReason';
import { DeliveryStatusTag } from './NotificationTags';

/** 마지막 오류 — 빨간 글자 한 줄은 눈에 덜 띄어 옅은 빨간 상자에 이름표와 함께 둔다 */
export function ErrorBox({ message }: { message: string }) {
    return (
        <div className="border-semantic-error-strong/25 bg-semantic-error/5 flex flex-col gap-0.5 rounded-lg border px-3 py-2.5">
            <span className="text-caption text-semantic-error-strong font-semibold">
                마지막 오류
            </span>
            <span className="text-body-sm text-fg-primary break-words">{message}</span>
        </div>
    );
}

const kstOrDash = (iso: string | null) => (iso ? formatKst(iso) : '-');

/**
 * 개별 알림 모의 발송 진단 상세(목록 옆 칸) — AN04 목록 응답 필드만으로 구성한다.
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
        <InspectorPanel open={open} onOpenChange={onOpenChange}>
            <InspectorBody>
                <InspectorHeader>
                    <InspectorTitle>{notification?.title ?? '발송 상세'}</InspectorTitle>
                    <InspectorDescription>
                        {notification
                            ? `받는 사람 ${notification.userName ?? notification.userId}`
                            : ''}
                    </InspectorDescription>
                </InspectorHeader>
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
                            <p className="text-fg-primary text-lg leading-7 font-semibold">
                                {notification.mockSentAt
                                    ? `${formatKst(notification.mockSentAt)}에 보냈어요 · ${notification.deliveryAttemptCount}회 시도`
                                    : `아직 보내지 않았어요 · ${notification.deliveryAttemptCount}회 시도`}
                            </p>
                            {notification.lastDeliveryError && (
                                <ErrorBox message={notification.lastDeliveryError} />
                            )}
                            {blockReason && (
                                <p className="text-caption text-fg-tertiary">{blockReason}</p>
                            )}
                            {/* 할 수 있는 행동은 요약 바로 아래 — 상태를 읽고 같은 자리에서 복구한다 */}
                            {action && <div>{action(notification, blockReason)}</div>}
                        </DetailSummary>

                        {/* 사용자가 받는 모습 그대로 — 알림 한 장처럼 보여 무엇이 나갔는지 바로 읽힌다 */}
                        <DetailSection title="보낸 알림">
                            <div className="border-border-default bg-surface-page flex flex-col gap-1 rounded-xl border p-4 shadow-sm">
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
            </InspectorBody>
        </InspectorPanel>
    );
}
