import { formatKst } from '@shared/utils/date';

import type { AdminNotification } from './types';

/**
 * 서버가 계산한 retryable=false의 읽기용 근거 — 응답 필드만으로 설명하고
 * FE에서 복구 가능 여부를 다시 계산하지 않는다
 */
export function deliveryRetryBlockReason(notification: AdminNotification): string | null {
    if (notification.retryable) return null;
    if (notification.mockDeliveryStatus === 'SENT') return '이미 발송이 완료된 알림입니다.';
    if (notification.mockDeliveryStatus === 'PENDING')
        return notification.nextDeliveryAttemptAt
            ? `자동 발송이 예약되어 있습니다 (다음: ${formatKst(notification.nextDeliveryAttemptAt)}).`
            : '발송 대기 중인 알림입니다.';
    if (notification.nextDeliveryAttemptAt)
        return `자동 재시도가 예약되어 있습니다 (다음: ${formatKst(notification.nextDeliveryAttemptAt)}).`;
    return '복구할 수 없는 상태입니다.';
}
