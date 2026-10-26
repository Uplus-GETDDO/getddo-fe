import { useMutation, useQueryClient } from '@tanstack/react-query';

import {
    ADMIN_NOTIFICATIONS_KEY,
    notificationDeliveryRetriesApiPath,
    notificationJobRetryApiPath,
} from '@entities/adminNotification';
import { apiClient } from '@shared/api/client';

export type BulkRetryKind = 'job' | 'delivery';

export interface BulkRetryResult {
    accepted: number;
    failed: number;
}

/**
 * 일괄 재시도 — 일괄 API가 없어 AN03(작업)·AN05(발송)를 한 건씩 차례로 접수한다.
 * 동시에 몰아 보내지 않는 건 서버 선점·상태 재확인(접수 시점 판정)을 한 건씩 거치게 하려는 것이다.
 * 한 건이 실패해도 나머지는 계속 보내고, 끝나면 접수·실패 건수를 돌려준 뒤 목록을 한 번만 다시 받는다
 */
export function useBulkRetryNotifications(kind: BulkRetryKind) {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (ids: string[]): Promise<BulkRetryResult> => {
            let accepted = 0;
            let failed = 0;
            for (const id of ids) {
                try {
                    await apiClient.post<unknown>(
                        kind === 'job'
                            ? notificationJobRetryApiPath(id)
                            : notificationDeliveryRetriesApiPath(id),
                    );
                    accepted += 1;
                } catch {
                    failed += 1;
                }
            }
            return { accepted, failed };
        },
        onSettled: () => {
            void queryClient.invalidateQueries({ queryKey: ADMIN_NOTIFICATIONS_KEY });
        },
    });
}
