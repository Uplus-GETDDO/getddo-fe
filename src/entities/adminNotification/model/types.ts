import { z } from 'zod';

// AN01~AN05 확정 계약 (getddo-spec/05-api/notification.md '관리자 알림 운영', 2026-10-12)
export const notificationTypeSchema = z.enum([
    'EVENT_START',
    'RESULT_PUBLISHED',
    'ENTRY_EXCLUDED',
    'EVENT_SCHEDULE_CHANGED',
    'EVENT_CANCELED',
    'RESULT_CHANGED',
]);

export const notificationJobStatusSchema = z.enum(['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED']);

export const mockDeliveryStatusSchema = z.enum(['PENDING', 'SENT', 'FAILED']);

// NotificationJob — 알림 생성 작업. retryable은 조회 시점의 복구 가능 여부다
export const notificationJobSchema = z.object({
    id: z.string(),
    eventId: z.string().nullable(),
    publicationId: z.string().nullable(),
    notificationType: notificationTypeSchema,
    status: notificationJobStatusSchema,
    attemptCount: z.number().int(),
    scheduledAt: z.iso.datetime(),
    nextAttemptAt: z.iso.datetime().nullable(),
    createdAt: z.iso.datetime(),
    completedAt: z.iso.datetime().nullable(),
    // 값이 있으면 일정 변경·취소로 중지된 작업 — PENDING/PROCESSING이어도 실행·복구 대상이 아니다
    generationStoppedBy: z.string().nullable(),
    retryable: z.boolean(),
});

// NotificationJobDetail — AN02 상세. 목록 필드 + 진단용 내부 필드
export const notificationJobDetailSchema = notificationJobSchema.extend({
    lastError: z.string().nullable(),
    sourceJobId: z.string().nullable(),
    lastProcessedUserId: z.string().nullable(),
    leaseUntil: z.iso.datetime().nullable(),
});

// AdminNotification — 개별 사용자 알림의 모의 발송 이력
export const adminNotificationSchema = z.object({
    id: z.string(),
    jobId: z.string(),
    userId: z.string(),
    // ADR-028 표시용 수신자 현재 이름 — BE 미배포라 생략·null을 허용한다
    userName: z.string().nullish(),
    eventId: z.string().nullable(),
    title: z.string(),
    body: z.string(),
    linkUrl: z.string().nullable(),
    createdAt: z.iso.datetime(),
    isRead: z.boolean(),
    mockDeliveryStatus: mockDeliveryStatusSchema,
    mockSentAt: z.iso.datetime().nullable(),
    deliveryAttemptCount: z.number().int(),
    nextDeliveryAttemptAt: z.iso.datetime().nullable(),
    lastDeliveryError: z.string().nullable(),
    retryable: z.boolean(),
});

export type NotificationType = z.infer<typeof notificationTypeSchema>;
export type NotificationJobStatus = z.infer<typeof notificationJobStatusSchema>;
export type MockDeliveryStatus = z.infer<typeof mockDeliveryStatusSchema>;
export type NotificationJob = z.infer<typeof notificationJobSchema>;
export type NotificationJobDetail = z.infer<typeof notificationJobDetailSchema>;
export type AdminNotification = z.infer<typeof adminNotificationSchema>;

export const NOTIFICATION_TYPE_LABEL: Record<NotificationType, string> = {
    EVENT_START: '이벤트 시작',
    RESULT_PUBLISHED: '결과 발표',
    ENTRY_EXCLUDED: '응모 제외',
    EVENT_SCHEDULE_CHANGED: '일정 변경',
    EVENT_CANCELED: '이벤트 취소',
    RESULT_CHANGED: '결과 변경',
};

export const NOTIFICATION_JOB_STATUS_LABEL: Record<NotificationJobStatus, string> = {
    PENDING: '대기',
    PROCESSING: '처리 중',
    COMPLETED: '완료',
    FAILED: '실패',
};

export const MOCK_DELIVERY_STATUS_LABEL: Record<MockDeliveryStatus, string> = {
    PENDING: '발송 대기',
    SENT: '발송 완료',
    FAILED: '발송 실패',
};
