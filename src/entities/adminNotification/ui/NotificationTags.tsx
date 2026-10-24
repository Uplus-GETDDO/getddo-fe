import { badgeVariants } from '@shared/ui/badge';
import { cn } from '@shared/utils/cn';

import type { MockDeliveryStatus, NotificationJobStatus } from '../model/types';

import { MOCK_DELIVERY_STATUS_LABEL, NOTIFICATION_JOB_STATUS_LABEL } from '../model/types';

// 상태·분류 칩 — 사용자 화면과 같은 공용 배지 모양(둥근 알약, 높이 26·글자 12)에 색만 칩마다 입힌다
const CHIP = badgeVariants({ variant: null });

/*
 * 상태 색은 서버 상태값(BE NotificationJobStatus·MockDeliveryStatus)과 1:1 — 대기 노랑 · 처리 중 파랑 · 완료 초록 · 실패 빨강.
 * '중지'는 상태가 아니다. 서버에 중지 상태·중지 API는 없고, 이벤트 일정 변경·취소·삭제 때 시작 알림 작업에
 * generationStoppedBy(내부 키)를 남겨 생성을 멈출 뿐이라 상태 태그 옆 흐린 보조 표시로만 둔다
 */
const JOB_STATUS_CHIP: Record<NotificationJobStatus, string> = {
    PENDING: 'bg-status-revision text-status-revision-text',
    PROCESSING: 'bg-status-active text-status-active-text',
    COMPLETED: 'bg-status-approved text-status-approved-text',
    FAILED: 'bg-status-rejected text-status-rejected-text',
};

const DELIVERY_STATUS_CHIP: Record<MockDeliveryStatus, string> = {
    PENDING: 'bg-status-revision text-status-revision-text',
    SENT: 'bg-status-approved text-status-approved-text',
    FAILED: 'bg-status-rejected text-status-rejected-text',
};

export const AUTO_STOPPED_HINT = '이벤트 일정이 바뀌거나 취소·삭제돼 서버가 알림 생성을 멈췄어요';

export function JobStatusTags({
    status,
    stopped,
}: {
    status: NotificationJobStatus;
    /** generationStoppedBy가 있는 작업 */
    stopped: boolean;
}) {
    return (
        <span className="inline-flex flex-wrap items-center gap-1.5">
            <span className={cn(CHIP, 'whitespace-nowrap', JOB_STATUS_CHIP[status])}>
                {NOTIFICATION_JOB_STATUS_LABEL[status]}
            </span>
            {stopped && (
                <span
                    title={AUTO_STOPPED_HINT}
                    className={cn(
                        CHIP,
                        'border-border-default text-fg-tertiary bg-transparent whitespace-nowrap',
                    )}
                >
                    자동 중단
                </span>
            )}
        </span>
    );
}

export function DeliveryStatusTag({ status }: { status: MockDeliveryStatus }) {
    return (
        <span className={cn(CHIP, 'whitespace-nowrap', DELIVERY_STATUS_CHIP[status])}>
            {MOCK_DELIVERY_STATUS_LABEL[status]}
        </span>
    );
}
