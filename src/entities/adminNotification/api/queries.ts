import { useQuery } from '@tanstack/react-query';

import { apiClient } from '@shared/api/client';
import { envelopeSchema, pageSchema } from '@shared/api/envelopeSchema';
import { queryPresets } from '@shared/api/queryPresets';

import {
    adminNotificationSchema,
    notificationJobDetailSchema,
    notificationJobSchema,
} from '../model/types';

export const ADMIN_NOTIFICATIONS_KEY = ['admin', 'notifications'] as const;

// AN01~AN05 확정 경로 — /api/v1 접두사 포함 실제 경로다 (N01~N03와 같은 /v1 규약)
export const ADMIN_NOTIFICATION_JOBS_API_PATH = '/v1/admin/notification-jobs';
export const notificationJobApiPath = (jobId: string) =>
    `${ADMIN_NOTIFICATION_JOBS_API_PATH}/${jobId}`;
export const notificationJobRetryApiPath = (jobId: string) =>
    `${notificationJobApiPath(jobId)}/retry`;
export const ADMIN_NOTIFICATIONS_API_PATH = '/v1/admin/notifications';
export const notificationDeliveryRetriesApiPath = (notificationId: string) =>
    `${ADMIN_NOTIFICATIONS_API_PATH}/${notificationId}/delivery-retries`;

interface PageParams {
    page: number;
    size: number;
}

export interface AdminNotificationJobsParams extends PageParams {
    status?: string;
    notificationType?: string;
    eventId?: string;
    from?: string;
    to?: string;
}

export interface AdminNotificationsParams extends PageParams {
    userId?: string;
    eventId?: string;
    jobId?: string;
    mockDeliveryStatus?: string;
    from?: string;
    to?: string;
}

// 운영 화면은 접수·처리 상태가 수시로 바뀌므로 들어올 때마다 새로 받는다.
// 페이지·필터를 바꾸면 새 결과가 올 때까지 이전 목록을 둔다
const adminListOptions = {
    ...queryPresets.noCache,
    ...queryPresets.paged,
} as const;

// AN01 — 알림 생성 작업 목록
export function useAdminNotificationJobs(params: AdminNotificationJobsParams) {
    return useQuery({
        ...adminListOptions,
        queryKey: [...ADMIN_NOTIFICATIONS_KEY, 'jobs', params],
        queryFn: async () => {
            const { data } = await apiClient.get<unknown>(ADMIN_NOTIFICATION_JOBS_API_PATH, {
                params,
            });
            return envelopeSchema(pageSchema(notificationJobSchema)).parse(data).data;
        },
    });
}

// AN02 — 작업 상세. 드로어처럼 조건부로 쓰는 호출이라 jobId가 없으면 끈다
export function useAdminNotificationJob(jobId: string | null) {
    return useQuery({
        ...adminListOptions,
        queryKey: [...ADMIN_NOTIFICATIONS_KEY, 'job', jobId],
        enabled: Boolean(jobId),
        queryFn: async () => {
            const { data } = await apiClient.get<unknown>(notificationJobApiPath(jobId!));
            return envelopeSchema(notificationJobDetailSchema).parse(data).data;
        },
    });
}

// AN04 — 개별 알림 모의 발송 이력
export function useAdminNotifications(params: AdminNotificationsParams) {
    return useQuery({
        ...adminListOptions,
        queryKey: [...ADMIN_NOTIFICATIONS_KEY, 'deliveries', params],
        queryFn: async () => {
            const { data } = await apiClient.get<unknown>(ADMIN_NOTIFICATIONS_API_PATH, {
                params,
            });
            return envelopeSchema(pageSchema(adminNotificationSchema)).parse(data).data;
        },
    });
}
