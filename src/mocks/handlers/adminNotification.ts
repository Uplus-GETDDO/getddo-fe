import { http } from 'msw';

import type {
    AdminNotification,
    NotificationJob,
    NotificationJobDetail,
} from '@entities/adminNotification';

import { env } from '@shared/config/env';

import { DAY, HOUR, MINUTE, demoTime } from '../demoTime';
import { mockNow } from '../now';
import { fail, ok } from './response';
import { findMockVirtualUser } from './virtualUsers';

/*
 * 관리자 알림 운영 목업 — AN01~AN05 확정 계약 (getddo-spec/05-api/notification.md, 2026-10-12).
 * 생성 작업은 Detail까지 보관하고 목록(AN01)은 NotificationJob 필드만 내보낸다.
 * 복구 접수(AN03·AN05)는 최종 실패·자동 재시도 없음·중지 아님·선점 없음을 다시 확인한다.
 * EVENT_START의 '시작 전 이벤트만 복구 허용' 제한은 이벤트 저장소와 연결하지 않고
 * 시드의 retryable 값으로 표현한다 — 실제 시점 판정은 서버 책임이다.
 */
const api = (path: string) => `${env.apiBaseUrl}${path}`;

const RETRY_DELAY_MS = 60 * 1000;

const jobSeeds: NotificationJobDetail[] = [
    {
        id: '0199c001-0014-7000-8000-000000000014',
        eventId: 'evt-187',
        publicationId: 'pub-188',
        notificationType: 'RESULT_CHANGED',
        status: 'FAILED',
        attemptCount: 4,
        scheduledAt: demoTime(-14 * DAY + 12 * HOUR),
        nextAttemptAt: null,
        createdAt: demoTime(-14 * DAY + 11 * HOUR + 55 * MINUTE),
        completedAt: null,
        generationStoppedBy: null,
        retryable: true,
        lastError: '일시적 DB 연결 오류 — 알림 생성 트랜잭션 실패',
        sourceJobId: '0199c001-0002-7000-8000-000000000002',
        lastProcessedUserId: 'vu-yuna',
        leaseUntil: null,
    },
    {
        id: '0199c001-0005-7000-8000-000000000005',
        eventId: 'evt-201',
        publicationId: null,
        notificationType: 'EVENT_SCHEDULE_CHANGED',
        status: 'PENDING',
        attemptCount: 0,
        scheduledAt: demoTime(DAY),
        nextAttemptAt: null,
        createdAt: demoTime(-14 * DAY + 10 * HOUR),
        completedAt: null,
        generationStoppedBy: null,
        retryable: false,
        lastError: null,
        sourceJobId: null,
        lastProcessedUserId: null,
        leaseUntil: null,
    },
    {
        id: '0199c001-0004-7000-8000-000000000004',
        eventId: null,
        publicationId: null,
        notificationType: 'ENTRY_EXCLUDED',
        status: 'PROCESSING',
        attemptCount: 1,
        scheduledAt: demoTime(-14 * DAY + 9 * HOUR),
        nextAttemptAt: null,
        createdAt: demoTime(-14 * DAY + 8 * HOUR + 58 * MINUTE),
        completedAt: null,
        generationStoppedBy: null,
        retryable: false,
        lastError: null,
        sourceJobId: null,
        lastProcessedUserId: 'vu-haneul',
        leaseUntil: demoTime(HOUR),
    },
    {
        id: '0199c001-0007-7000-8000-000000000007',
        eventId: 'evt-201',
        publicationId: 'pub-201',
        notificationType: 'RESULT_CHANGED',
        status: 'FAILED',
        attemptCount: 4,
        scheduledAt: demoTime(-15 * DAY + 7 * HOUR),
        nextAttemptAt: null,
        createdAt: demoTime(-15 * DAY + 6 * HOUR + 55 * MINUTE),
        completedAt: null,
        generationStoppedBy: 'EVENT_SCHEDULE_CHANGED',
        retryable: false,
        lastError: '일정 변경으로 생성이 중지되었습니다.',
        sourceJobId: null,
        lastProcessedUserId: null,
        leaseUntil: null,
    },
    {
        id: '0199c001-0003-7000-8000-000000000003',
        eventId: 'evt-099',
        publicationId: null,
        notificationType: 'EVENT_START',
        status: 'FAILED',
        attemptCount: 2,
        scheduledAt: demoTime(-15 * DAY + 5 * HOUR + 50 * MINUTE),
        nextAttemptAt: demoTime(2 * HOUR),
        createdAt: demoTime(-15 * DAY + 5 * HOUR + 45 * MINUTE),
        completedAt: null,
        generationStoppedBy: null,
        retryable: false,
        lastError: '일시적 연결 오류 — 자동 재시도 대기 중',
        sourceJobId: null,
        lastProcessedUserId: 'vu-doyoon',
        leaseUntil: null,
    },
    {
        id: '0199c001-0008-7000-8000-000000000008',
        eventId: 'evt-330',
        publicationId: null,
        notificationType: 'EVENT_START',
        status: 'FAILED',
        // 반복 실행으로 해결되지 않는 오류는 즉시 최종 실패 — 1회만 시도해도 최종 실패가 된다
        attemptCount: 1,
        scheduledAt: demoTime(-16 * DAY + 4 * HOUR),
        nextAttemptAt: null,
        createdAt: demoTime(-16 * DAY + 3 * HOUR + 55 * MINUTE),
        completedAt: null,
        generationStoppedBy: null,
        retryable: true,
        lastError: '데이터 제약 오류 — 즉시 최종 실패로 기록',
        sourceJobId: null,
        lastProcessedUserId: null,
        leaseUntil: null,
    },
    {
        id: '0199c001-0009-7000-8000-000000000009',
        eventId: 'evt-330',
        publicationId: 'pub-330',
        notificationType: 'RESULT_PUBLISHED',
        status: 'PENDING',
        attemptCount: 0,
        scheduledAt: demoTime(13 * HOUR),
        nextAttemptAt: null,
        createdAt: demoTime(-16 * DAY + 2 * HOUR),
        completedAt: null,
        generationStoppedBy: null,
        retryable: false,
        lastError: null,
        sourceJobId: null,
        lastProcessedUserId: null,
        leaseUntil: null,
    },
    {
        id: '0199c001-0002-7000-8000-000000000002',
        eventId: 'evt-187',
        publicationId: 'pub-188',
        notificationType: 'RESULT_PUBLISHED',
        status: 'FAILED',
        attemptCount: 4,
        scheduledAt: demoTime(-17 * DAY + 3 * HOUR),
        nextAttemptAt: null,
        createdAt: demoTime(-17 * DAY + 2 * HOUR + 55 * MINUTE),
        completedAt: null,
        generationStoppedBy: null,
        retryable: true,
        lastError: 'DB 연결 시간 초과 — 알림 생성 트랜잭션 실패',
        sourceJobId: null,
        lastProcessedUserId: 'vu-seoyeon',
        leaseUntil: null,
    },
    {
        id: '0199c001-0006-7000-8000-000000000006',
        eventId: 'evt-187',
        publicationId: null,
        notificationType: 'EVENT_CANCELED',
        status: 'COMPLETED',
        attemptCount: 1,
        scheduledAt: demoTime(-18 * DAY + 6 * HOUR),
        nextAttemptAt: null,
        createdAt: demoTime(-18 * DAY + 5 * HOUR + 58 * MINUTE),
        completedAt: demoTime(-18 * DAY + 6 * HOUR + 31000),
        generationStoppedBy: null,
        retryable: false,
        lastError: null,
        sourceJobId: null,
        lastProcessedUserId: null,
        leaseUntil: null,
    },
    {
        id: '0199c001-0010-7000-8000-000000000010',
        eventId: 'evt-099',
        publicationId: null,
        notificationType: 'ENTRY_EXCLUDED',
        status: 'COMPLETED',
        attemptCount: 2,
        scheduledAt: demoTime(-19 * DAY + 8 * HOUR),
        nextAttemptAt: null,
        createdAt: demoTime(-19 * DAY + 7 * HOUR + 55 * MINUTE),
        completedAt: demoTime(-19 * DAY + 8 * HOUR + MINUTE + 10000),
        generationStoppedBy: null,
        retryable: false,
        lastError: null,
        sourceJobId: null,
        lastProcessedUserId: 'vu-jiwoo',
        leaseUntil: null,
    },
    {
        id: '0199c001-0013-7000-8000-000000000013',
        eventId: 'evt-330',
        publicationId: null,
        notificationType: 'EVENT_SCHEDULE_CHANGED',
        status: 'COMPLETED',
        attemptCount: 1,
        scheduledAt: demoTime(-19 * DAY + HOUR),
        nextAttemptAt: null,
        createdAt: demoTime(-19 * DAY + 55 * MINUTE),
        completedAt: demoTime(-19 * DAY + HOUR + 22000),
        generationStoppedBy: null,
        retryable: false,
        lastError: null,
        sourceJobId: null,
        lastProcessedUserId: null,
        leaseUntil: null,
    },
    {
        id: '0199c001-0011-7000-8000-000000000011',
        eventId: 'evt-042',
        publicationId: null,
        notificationType: 'EVENT_START',
        status: 'FAILED',
        attemptCount: 4,
        scheduledAt: demoTime(-20 * DAY + 9 * HOUR),
        nextAttemptAt: null,
        createdAt: demoTime(-20 * DAY + 8 * HOUR + 55 * MINUTE),
        completedAt: null,
        generationStoppedBy: 'EVENT_CANCELED',
        retryable: false,
        lastError: '이벤트 취소로 생성이 중지되었습니다.',
        sourceJobId: null,
        lastProcessedUserId: null,
        leaseUntil: null,
    },
    {
        id: '0199c001-0012-7000-8000-000000000012',
        eventId: 'evt-042',
        publicationId: 'pub-042',
        notificationType: 'RESULT_PUBLISHED',
        status: 'FAILED',
        attemptCount: 4,
        scheduledAt: demoTime(-20 * DAY + 7 * HOUR),
        nextAttemptAt: null,
        createdAt: demoTime(-20 * DAY + 6 * HOUR + 55 * MINUTE),
        completedAt: null,
        generationStoppedBy: null,
        retryable: true,
        lastError: '일시적 DB 장애 — 최대 자동 재시도 후 최종 실패',
        sourceJobId: null,
        lastProcessedUserId: 'vu-minjun',
        leaseUntil: null,
    },
    {
        id: '0199c001-0001-7000-8000-000000000001',
        eventId: 'evt-201',
        publicationId: null,
        notificationType: 'EVENT_START',
        status: 'COMPLETED',
        attemptCount: 1,
        scheduledAt: demoTime(-20 * DAY + HOUR),
        nextAttemptAt: null,
        createdAt: demoTime(-20 * DAY + 55 * MINUTE),
        completedAt: demoTime(-20 * DAY + HOUR + 40000),
        generationStoppedBy: null,
        retryable: false,
        lastError: null,
        sourceJobId: null,
        lastProcessedUserId: null,
        leaseUntil: null,
    },
];

const notificationSeeds: AdminNotification[] = [
    {
        id: '0199c101-0016-7000-8000-000000000016',
        jobId: '0199c001-0012-7000-8000-000000000012',
        userId: 'vu-seoyeon',
        eventId: 'evt-042',
        title: '당첨자 발표 안내',
        body: 'VVIP 데이터 쿠폰 래플 당첨자가 발표되었습니다.',
        linkUrl: '/events/evt-042',
        createdAt: demoTime(-20 * DAY + 7 * HOUR + 2 * MINUTE),
        isRead: false,
        mockDeliveryStatus: 'FAILED',
        mockSentAt: null,
        deliveryAttemptCount: 4,
        nextDeliveryAttemptAt: null,
        lastDeliveryError: '모의 발송 연결 시간 초과',
        retryable: true,
    },
    {
        id: '0199c101-0015-7000-8000-000000000015',
        jobId: '0199c001-0001-7000-8000-000000000001',
        userId: 'vu-haneul',
        eventId: 'evt-201',
        title: '이벤트 시작 알림',
        body: '닌텐도 스위치 2 래플 응모가 시작되었습니다.',
        linkUrl: '/events/evt-201',
        createdAt: demoTime(-20 * DAY + HOUR + 45000),
        isRead: true,
        mockDeliveryStatus: 'SENT',
        mockSentAt: demoTime(-20 * DAY + HOUR + 50000),
        deliveryAttemptCount: 1,
        nextDeliveryAttemptAt: null,
        lastDeliveryError: null,
        retryable: false,
    },
    {
        id: '0199c101-0014-7000-8000-000000000014',
        jobId: '0199c001-0002-7000-8000-000000000002',
        userId: 'vu-jiwoo',
        eventId: 'evt-187',
        title: '당첨자 발표 안내',
        body: '스타벅스 e카드 래플 당첨자가 발표되었습니다.',
        linkUrl: '/events/evt-187',
        createdAt: demoTime(-17 * DAY + 3 * HOUR + MINUTE),
        isRead: false,
        mockDeliveryStatus: 'FAILED',
        mockSentAt: null,
        deliveryAttemptCount: 4,
        nextDeliveryAttemptAt: null,
        lastDeliveryError: '모의 발송 일시 오류',
        retryable: true,
    },
    {
        id: '0199c101-0013-7000-8000-000000000013',
        jobId: '0199c001-0013-7000-8000-000000000013',
        userId: 'vu-doyoon',
        eventId: 'evt-330',
        title: '일정 변경 안내',
        body: '참여 중인 이벤트 일정이 변경되었습니다.',
        linkUrl: '/events/evt-330',
        createdAt: demoTime(-19 * DAY + HOUR + 30000),
        isRead: true,
        mockDeliveryStatus: 'SENT',
        mockSentAt: demoTime(-19 * DAY + HOUR + 35000),
        deliveryAttemptCount: 1,
        nextDeliveryAttemptAt: null,
        lastDeliveryError: null,
        retryable: false,
    },
    {
        id: '0199c101-0012-7000-8000-000000000012',
        jobId: '0199c001-0010-7000-8000-000000000010',
        userId: 'vu-jiwoo',
        eventId: 'evt-099',
        title: '이벤트 운영 안내',
        body: '이벤트의 최신 운영 정보를 확인해 주세요.',
        linkUrl: null,
        createdAt: demoTime(-19 * DAY + 8 * HOUR + MINUTE + 20000),
        isRead: false,
        mockDeliveryStatus: 'FAILED',
        mockSentAt: null,
        deliveryAttemptCount: 4,
        nextDeliveryAttemptAt: null,
        lastDeliveryError: '모의 발송 일시 오류',
        retryable: true,
    },
    {
        id: '0199c101-0011-7000-8000-000000000011',
        jobId: '0199c001-0010-7000-8000-000000000010',
        userId: 'vu-minjun',
        eventId: 'evt-099',
        title: '이벤트 운영 안내',
        body: '이벤트의 최신 운영 정보를 확인해 주세요.',
        linkUrl: null,
        createdAt: demoTime(-19 * DAY + 8 * HOUR + MINUTE + 18000),
        isRead: false,
        mockDeliveryStatus: 'SENT',
        mockSentAt: demoTime(-19 * DAY + 8 * HOUR + MINUTE + 25000),
        deliveryAttemptCount: 1,
        nextDeliveryAttemptAt: null,
        lastDeliveryError: null,
        retryable: false,
    },
    {
        id: '0199c101-0010-7000-8000-000000000010',
        jobId: '0199c001-0006-7000-8000-000000000006',
        userId: 'vu-haneul',
        eventId: 'evt-187',
        title: '이벤트 취소 안내',
        body: '스타벅스 e카드 래플이 취소되었습니다.',
        linkUrl: '/events/evt-187',
        createdAt: demoTime(-18 * DAY + 6 * HOUR + 40000),
        isRead: false,
        mockDeliveryStatus: 'PENDING',
        mockSentAt: null,
        deliveryAttemptCount: 0,
        nextDeliveryAttemptAt: demoTime(3 * HOUR),
        lastDeliveryError: null,
        retryable: false,
    },
    {
        id: '0199c101-0009-7000-8000-000000000009',
        jobId: '0199c001-0006-7000-8000-000000000006',
        userId: 'vu-seoyeon',
        eventId: 'evt-187',
        title: '이벤트 취소 안내',
        body: '스타벅스 e카드 래플이 취소되었습니다.',
        linkUrl: '/events/evt-187',
        createdAt: demoTime(-18 * DAY + 6 * HOUR + 38000),
        isRead: false,
        mockDeliveryStatus: 'FAILED',
        mockSentAt: null,
        deliveryAttemptCount: 4,
        nextDeliveryAttemptAt: null,
        lastDeliveryError: '모의 발송 일시 오류',
        retryable: true,
    },
    {
        id: '0199c101-0008-7000-8000-000000000008',
        jobId: '0199c001-0006-7000-8000-000000000006',
        userId: 'vu-doyoon',
        eventId: 'evt-187',
        title: '이벤트 취소 안내',
        body: '스타벅스 e카드 래플이 취소되었습니다.',
        linkUrl: '/events/evt-187',
        createdAt: demoTime(-18 * DAY + 6 * HOUR + 35000),
        isRead: true,
        mockDeliveryStatus: 'SENT',
        mockSentAt: demoTime(-18 * DAY + 6 * HOUR + 41000),
        deliveryAttemptCount: 1,
        nextDeliveryAttemptAt: null,
        lastDeliveryError: null,
        retryable: false,
    },
    {
        id: '0199c101-0007-7000-8000-000000000007',
        jobId: '0199c001-0001-7000-8000-000000000001',
        userId: 'vu-yuna',
        eventId: 'evt-201',
        title: '이벤트 시작 알림',
        body: '닌텐도 스위치 2 래플 응모가 시작되었습니다.',
        linkUrl: '/events/evt-201',
        createdAt: demoTime(-20 * DAY + HOUR + 44000),
        isRead: false,
        mockDeliveryStatus: 'PENDING',
        mockSentAt: null,
        deliveryAttemptCount: 0,
        nextDeliveryAttemptAt: null,
        lastDeliveryError: null,
        retryable: false,
    },
    {
        id: '0199c101-0006-7000-8000-000000000006',
        jobId: '0199c001-0001-7000-8000-000000000001',
        userId: 'vu-jiwoo',
        eventId: 'evt-201',
        title: '이벤트 시작 알림',
        body: '닌텐도 스위치 2 래플 응모가 시작되었습니다.',
        linkUrl: '/events/evt-201',
        createdAt: demoTime(-20 * DAY + HOUR + 43000),
        isRead: false,
        mockDeliveryStatus: 'SENT',
        mockSentAt: demoTime(-20 * DAY + HOUR + 48000),
        deliveryAttemptCount: 1,
        nextDeliveryAttemptAt: null,
        lastDeliveryError: null,
        retryable: false,
    },
    {
        id: '0199c101-0005-7000-8000-000000000005',
        jobId: '0199c001-0001-7000-8000-000000000001',
        userId: 'vu-doyoon',
        eventId: 'evt-201',
        title: '이벤트 시작 알림',
        body: '닌텐도 스위치 2 래플 응모가 시작되었습니다.',
        linkUrl: '/events/evt-201',
        createdAt: demoTime(-20 * DAY + HOUR + 42000),
        isRead: true,
        mockDeliveryStatus: 'SENT',
        mockSentAt: demoTime(-20 * DAY + HOUR + 47000),
        deliveryAttemptCount: 1,
        nextDeliveryAttemptAt: null,
        lastDeliveryError: null,
        retryable: false,
    },
    {
        id: '0199c101-0004-7000-8000-000000000004',
        jobId: '0199c001-0002-7000-8000-000000000002',
        userId: 'vu-minjun',
        eventId: 'evt-187',
        title: '당첨자 발표 안내',
        body: '스타벅스 e카드 래플 당첨자가 발표되었습니다.',
        linkUrl: '/events/evt-187',
        createdAt: demoTime(-17 * DAY + 3 * HOUR + 58000),
        isRead: false,
        mockDeliveryStatus: 'FAILED',
        mockSentAt: null,
        deliveryAttemptCount: 2,
        nextDeliveryAttemptAt: demoTime(4 * HOUR),
        lastDeliveryError: '모의 발송 일시 오류 — 자동 재시도 대기 중',
        retryable: false,
    },
    {
        id: '0199c101-0003-7000-8000-000000000003',
        jobId: '0199c001-0002-7000-8000-000000000002',
        userId: 'vu-haneul',
        eventId: 'evt-187',
        title: '당첨자 발표 안내',
        body: '스타벅스 e카드 래플 당첨자가 발표되었습니다.',
        linkUrl: '/events/evt-187',
        createdAt: demoTime(-17 * DAY + 3 * HOUR + 55000),
        isRead: false,
        mockDeliveryStatus: 'FAILED',
        mockSentAt: null,
        deliveryAttemptCount: 4,
        nextDeliveryAttemptAt: null,
        lastDeliveryError: '모의 발송 일시 오류',
        retryable: true,
    },
    {
        id: '0199c101-0002-7000-8000-000000000002',
        jobId: '0199c001-0002-7000-8000-000000000002',
        userId: 'vu-seoyeon',
        eventId: 'evt-187',
        title: '당첨자 발표 안내',
        body: '스타벅스 e카드 래플 당첨자가 발표되었습니다.',
        linkUrl: '/events/evt-187',
        createdAt: demoTime(-17 * DAY + 3 * HOUR + 52000),
        isRead: false,
        mockDeliveryStatus: 'FAILED',
        mockSentAt: null,
        deliveryAttemptCount: 4,
        nextDeliveryAttemptAt: null,
        lastDeliveryError: '모의 발송 일시 오류',
        retryable: true,
    },
    {
        id: '0199c101-0001-7000-8000-000000000001',
        jobId: '0199c001-0002-7000-8000-000000000002',
        userId: 'vu-doyoon',
        eventId: 'evt-187',
        title: '당첨자 발표 안내',
        body: '스타벅스 e카드 래플 당첨자가 발표되었습니다.',
        linkUrl: '/events/evt-187',
        createdAt: demoTime(-17 * DAY + 3 * HOUR + 50000),
        isRead: true,
        mockDeliveryStatus: 'SENT',
        mockSentAt: demoTime(-17 * DAY + 3 * HOUR + 58000),
        deliveryAttemptCount: 1,
        nextDeliveryAttemptAt: null,
        lastDeliveryError: null,
        retryable: false,
    },
];

const store = {
    jobs: [] as NotificationJobDetail[],
    notifications: [] as AdminNotification[],
};

// ADR-028 — 수신자의 현재 이름. vu-yuna는 BE 미배포 구간의 이름 생략 경로를 검증하기 위해 비워 둔다
const RECIPIENT_NAMES: Record<string, string | null> = {
    'vu-doyoon': '김도윤',
    'vu-seoyeon': '박서연',
    'vu-haneul': '이하늘',
    'vu-minjun': '최민준',
    'vu-jiwoo': '정지우',
    'vu-yuna': null,
};

function seedStore() {
    store.jobs = jobSeeds.map((job) => ({ ...job }));
    store.notifications = notificationSeeds.map((notification) => ({
        ...notification,
        userName: notification.userName ?? RECIPIENT_NAMES[notification.userId] ?? null,
    }));
}

seedStore();

// 테스트가 복구 접수로 바꾼 상태를 되돌릴 때 쓴다
export const resetAdminNotificationStore = seedStore;

// AN01은 NotificationJob만 반환한다 — 상세 필드(lastError 등)는 AN02에서만 내린다
const toJob = ({
    id,
    eventId,
    publicationId,
    notificationType,
    status,
    attemptCount,
    scheduledAt,
    nextAttemptAt,
    createdAt,
    completedAt,
    generationStoppedBy,
    retryable,
}: NotificationJobDetail): NotificationJob => ({
    id,
    eventId,
    publicationId,
    notificationType,
    status,
    attemptCount,
    scheduledAt,
    nextAttemptAt,
    createdAt,
    completedAt,
    generationStoppedBy,
    retryable,
});

const JOB_TYPES = [
    'EVENT_START',
    'RESULT_PUBLISHED',
    'ENTRY_EXCLUDED',
    'EVENT_SCHEDULE_CHANGED',
    'EVENT_CANCELED',
    'RESULT_CHANGED',
];
const JOB_STATUSES = ['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED'];
const DELIVERY_STATUSES = ['PENDING', 'SENT', 'FAILED'];

const UUID = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

const badFormat = () => fail(400, 'COMMON-005', '요청 형식이 올바르지 않습니다.');
const badQuery = () => fail(400, 'NOTIFICATION-007', '조회 조건이 올바르지 않습니다.');
const notFound = () => fail(404, 'NOTIFICATION-009', '대상을 찾을 수 없습니다.');
const retryConflict = () =>
    fail(409, 'NOTIFICATION-010', '복구할 수 없는 상태입니다. 조건을 확인해 주세요.');

const TZ_SUFFIX = /(Z|[+-]\d{2}:?\d{2})$/;

interface Range {
    from: string | null;
    to: string | null;
}

// 'format'은 시각 형식 오류, 'order'는 from>=to 순서 오류 — 계약이 두 경우의 코드를 나눈다
function parseRange(params: URLSearchParams): Range | 'format' | 'order' {
    const from = params.get('from');
    const to = params.get('to');
    for (const value of [from, to]) {
        if (value !== null && (!TZ_SUFFIX.test(value) || Number.isNaN(Date.parse(value)))) {
            return 'format';
        }
    }
    if (from && to && Date.parse(from) >= Date.parse(to)) return 'order';
    return { from, to };
}

const inRange = (iso: string, { from, to }: Range) =>
    (!from || Date.parse(iso) >= Date.parse(from)) && (!to || Date.parse(iso) < Date.parse(to));

// 페이지는 1부터, size는 1~100(기본 20). 숫자 형식은 'format', 범위는 'order'로 구분한다
function paginate<T>(rows: T[], params: URLSearchParams) {
    const rawPage = params.get('page') ?? '1';
    const rawSize = params.get('size') ?? '20';
    if (!/^\d+$/.test(rawPage) || !/^\d+$/.test(rawSize)) return 'format' as const;
    const page = Number(rawPage);
    const size = Number(rawSize);
    if (page < 1 || size < 1 || size > 100) return 'order' as const;
    return {
        items: rows.slice((page - 1) * size, page * size),
        page,
        size,
        totalElements: rows.length,
    };
}

// createdAt DESC, id DESC
const newestFirst =
    <T extends { id: string }>(timeOf: (row: T) => string) =>
    (a: T, b: T) =>
        timeOf(b).localeCompare(timeOf(a)) || b.id.localeCompare(a.id);

// AN 계열 공통 게이트 — 헤더 필수·DB 대조·관리자 확인 순서는 확정 오류 표를 따른다
function adminGate(request: Request) {
    const userId = request.headers.get('X-User-ID');
    const role = request.headers.get('X-User-Role');
    if (!userId || !role) {
        return fail(401, 'USER-003', '사용자 문맥이 필요합니다.');
    }
    const user = findMockVirtualUser(userId);
    if (!user) return fail(401, 'USER-002', '등록되지 않은 사용자입니다.');
    if (user.role !== role) {
        return fail(403, 'USER-004', '사용자 역할 정보가 일치하지 않습니다.');
    }
    const membership = request.headers.get('X-User-Membership');
    if (membership && membership !== user.membership) {
        return fail(409, 'USER-006', '사용자 멤버십 정보가 일치하지 않습니다.');
    }
    if (user.role !== 'ADMIN') {
        return fail(403, 'NOTIFICATION-008', '관리자만 사용할 수 있습니다.');
    }
    return null;
}

// 최종 실패(FAILED)·자동 재시도 없음·중지 아님·유효 선점 없음·retryable — 접수 시 다시 확인한다
const jobRetryable = (job: NotificationJobDetail, now: Date) =>
    job.status === 'FAILED' &&
    !job.nextAttemptAt &&
    !job.generationStoppedBy &&
    !(job.leaseUntil && Date.parse(job.leaseUntil) > now.getTime()) &&
    job.retryable;

const deliveryRetryable = (notification: AdminNotification) =>
    notification.mockDeliveryStatus === 'FAILED' &&
    !notification.nextDeliveryAttemptAt &&
    notification.retryable;

export const adminNotificationHandlers = [
    // AN01 — 알림 생성 작업 목록
    http.get(api('/v1/admin/notification-jobs'), ({ request }) => {
        const denied = adminGate(request);
        if (denied) return denied;
        const params = new URL(request.url).searchParams;
        const status = params.get('status');
        const notificationType = params.get('notificationType');
        const eventId = params.get('eventId');
        if (status && !JOB_STATUSES.includes(status)) return badFormat();
        if (notificationType && !JOB_TYPES.includes(notificationType)) return badFormat();
        const range = parseRange(params);
        if (range === 'format') return badFormat();
        if (range === 'order') return badQuery();

        const rows = store.jobs
            .filter((job) => {
                if (status && job.status !== status) return false;
                if (notificationType && job.notificationType !== notificationType) return false;
                if (eventId && job.eventId !== eventId) return false;
                return inRange(job.createdAt, range);
            })
            .sort(newestFirst((job) => job.createdAt))
            .map(toJob);

        const result = paginate(rows, params);
        if (result === 'format') return badFormat();
        if (result === 'order') return badQuery();
        return ok(result);
    }),

    // AN02 — 작업 상세
    http.get(api('/v1/admin/notification-jobs/:jobId'), ({ request, params }) => {
        const denied = adminGate(request);
        if (denied) return denied;
        const jobId = String(params.jobId);
        if (!UUID.test(jobId)) return badFormat();
        const job = store.jobs.find((j) => j.id === jobId);
        if (!job) return notFound();
        return ok(job);
    }),

    // AN03 — 생성 복구 접수. 202는 처리 접수이며 최종 성공이 아니다
    http.post(api('/v1/admin/notification-jobs/:jobId/retry'), ({ request, params }) => {
        const denied = adminGate(request);
        if (denied) return denied;
        const jobId = String(params.jobId);
        if (!UUID.test(jobId)) return badFormat();
        const job = store.jobs.find((j) => j.id === jobId);
        if (!job) return notFound();
        const now = mockNow();
        if (!jobRetryable(job, now)) return retryConflict();

        // 접수 = 새 복구 구간의 시작 — 대기 상태로 돌리고 이미 접수된 재요청은 409로 막는다
        job.status = 'PENDING';
        job.retryable = false;
        job.nextAttemptAt = new Date(now.getTime() + RETRY_DELAY_MS).toISOString();
        return ok(toJob(job), 202);
    }),

    // AN04 — 개별 알림 모의 발송 이력
    http.get(api('/v1/admin/notifications'), ({ request }) => {
        const denied = adminGate(request);
        if (denied) return denied;
        const params = new URL(request.url).searchParams;
        const userId = params.get('userId');
        const eventId = params.get('eventId');
        const jobId = params.get('jobId');
        const mockDeliveryStatus = params.get('mockDeliveryStatus');
        if (mockDeliveryStatus && !DELIVERY_STATUSES.includes(mockDeliveryStatus)) {
            return badFormat();
        }
        const range = parseRange(params);
        if (range === 'format') return badFormat();
        if (range === 'order') return badQuery();

        const rows = store.notifications
            .filter((notification) => {
                if (userId && notification.userId !== userId) return false;
                if (eventId && notification.eventId !== eventId) return false;
                if (jobId && notification.jobId !== jobId) return false;
                if (mockDeliveryStatus && notification.mockDeliveryStatus !== mockDeliveryStatus) {
                    return false;
                }
                return inRange(notification.createdAt, range);
            })
            .sort(newestFirst((notification) => notification.createdAt));

        const result = paginate(rows, params);
        if (result === 'format') return badFormat();
        if (result === 'order') return badQuery();
        return ok(result);
    }),

    // AN05 — 개별 모의 발송 복구 접수. 같은 알림의 발송만 재시도한다
    http.post(
        api('/v1/admin/notifications/:notificationId/delivery-retries'),
        ({ request, params }) => {
            const denied = adminGate(request);
            if (denied) return denied;
            const notificationId = String(params.notificationId);
            if (!UUID.test(notificationId)) return badFormat();
            const notification = store.notifications.find((n) => n.id === notificationId);
            if (!notification) return notFound();
            if (!deliveryRetryable(notification)) return retryConflict();

            const now = mockNow();
            notification.mockDeliveryStatus = 'PENDING';
            notification.retryable = false;
            notification.nextDeliveryAttemptAt = new Date(
                now.getTime() + RETRY_DELAY_MS,
            ).toISOString();
            return ok(notification, 202);
        },
    ),
];
