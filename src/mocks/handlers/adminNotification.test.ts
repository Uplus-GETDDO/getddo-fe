import type { ZodType } from 'zod';

import { afterEach, describe, expect, it } from 'vitest';

import {
    adminNotificationSchema,
    notificationJobDetailSchema,
    notificationJobSchema,
} from '@entities/adminNotification';
import { apiClient } from '@shared/api/client';
import { envelopeSchema, pageSchema } from '@shared/api/envelopeSchema';

import { resetAdminNotificationStore } from './adminNotification';

/*
 * 관리자 알림 목업이 AN01~AN05 확정 계약(getddo-spec/05-api/notification.md)을
 * 지키는지 검증한다. 경로는 리터럴로 적어 상수와 핸들러가 함께 틀려도 계약 위반이 드러나게 한다.
 * 사용자 문맥 헤더는 세션 스토어와 무관하게 직접 붙인다.
 */
const ADMIN = { headers: { 'X-User-ID': 'vu-admin', 'X-User-Role': 'ADMIN' } };

interface RawBody {
    success: boolean;
    code: string;
    data: unknown;
}

const get = (
    path: string,
    params?: Record<string, unknown>,
    headers: Record<string, string> = ADMIN.headers,
) => apiClient.get<RawBody>(path, { params, headers, validateStatus: () => true });

const post = (path: string, headers: Record<string, string> = ADMIN.headers) =>
    apiClient.post<RawBody>(path, undefined, { headers, validateStatus: () => true });

const page = <T extends ZodType>(schema: T, body: unknown) =>
    envelopeSchema(pageSchema(schema)).parse(body).data;

afterEach(resetAdminNotificationStore);

const RETRYABLE_JOB = '0199c001-0002-7000-8000-000000000002';
const STOPPED_JOB = '0199c001-0007-7000-8000-000000000007';
const AUTO_RETRY_JOB = '0199c001-0003-7000-8000-000000000003';
const COMPLETED_JOB = '0199c001-0001-7000-8000-000000000001';
const RETRYABLE_NOTIFICATION = '0199c101-0002-7000-8000-000000000002';
const SENT_NOTIFICATION = '0199c101-0001-7000-8000-000000000001';

describe('관리자 게이트', () => {
    it('헤더가 없으면 401 USER-003, 미등록 사용자는 401 USER-002다', async () => {
        const noHeaders = await get('/v1/admin/notification-jobs', undefined, {});
        expect(noHeaders.status).toBe(401);
        expect(noHeaders.data.code).toBe('USER-003');

        const roleOnly = await get('/v1/admin/notification-jobs', undefined, {
            'X-User-Role': 'ADMIN',
        });
        expect(roleOnly.status).toBe(401);
        expect(roleOnly.data.code).toBe('USER-003');

        const unknown = await get('/v1/admin/notification-jobs', undefined, {
            'X-User-ID': 'nobody',
            'X-User-Role': 'ADMIN',
        });
        expect(unknown.status).toBe(401);
        expect(unknown.data.code).toBe('USER-002');
    });

    it('헤더 역할과 DB 역할이 다르면 403 USER-004, 일반 사용자는 403 NOTIFICATION-008이다', async () => {
        const mismatch = await get('/v1/admin/notification-jobs', undefined, {
            'X-User-ID': 'vu-doyoon',
            'X-User-Role': 'ADMIN',
        });
        expect(mismatch.status).toBe(403);
        expect(mismatch.data.code).toBe('USER-004');

        const user = await get('/v1/admin/notification-jobs', undefined, {
            'X-User-ID': 'vu-doyoon',
            'X-User-Role': 'USER',
        });
        expect(user.status).toBe(403);
        expect(user.data.code).toBe('NOTIFICATION-008');
    });

    it('선택 멤버십이 DB와 다르면 409 USER-006이다', async () => {
        const res = await get('/v1/admin/notification-jobs', undefined, {
            'X-User-ID': 'vu-admin',
            'X-User-Role': 'ADMIN',
            'X-User-Membership': 'vvip',
        });
        expect(res.status).toBe(409);
        expect(res.data.code).toBe('USER-006');
    });
});

describe('AN01 알림 작업 목록', () => {
    it('Page 봉투에 NotificationJob만 담고 최신순으로 반환한다', async () => {
        const res = await get('/v1/admin/notification-jobs');
        expect(res.status).toBe(200);
        const data = page(notificationJobSchema, res.data);
        expect(data.totalElements).toBe(14);
        const times = data.items.map((j) => j.createdAt);
        expect(times).toEqual([...times].sort().reverse());
        // 상세 전용 필드는 목록에 노출하지 않는다
        expect(data.items[0]).not.toHaveProperty('lastError');
        expect(data.items[0]).not.toHaveProperty('leaseUntil');
    });

    it('status·notificationType·eventId로 거른다', async () => {
        const failed = page(
            notificationJobSchema,
            (await get('/v1/admin/notification-jobs', { status: 'FAILED', size: 100 })).data,
        );
        expect(failed.items.length).toBeGreaterThan(0);
        expect(failed.items.every((j) => j.status === 'FAILED')).toBe(true);

        const starts = page(
            notificationJobSchema,
            (await get('/v1/admin/notification-jobs', { notificationType: 'EVENT_START' })).data,
        );
        expect(starts.items.every((j) => j.notificationType === 'EVENT_START')).toBe(true);

        const event = page(
            notificationJobSchema,
            (await get('/v1/admin/notification-jobs', { eventId: 'evt-187' })).data,
        );
        expect(event.items.every((j) => j.eventId === 'evt-187')).toBe(true);
    });

    it('기간은 생성 시각의 [from, to)다', async () => {
        const res = await get('/v1/admin/notification-jobs', {
            size: 100,
            from: '2026-10-06T00:00:00Z',
            to: '2026-10-08T00:00:00Z',
        });
        const data = page(notificationJobSchema, res.data);
        expect(data.items.length).toBeGreaterThan(0);
        expect(
            data.items.every(
                (j) =>
                    j.createdAt >= '2026-10-06T00:00:00Z' && j.createdAt < '2026-10-08T00:00:00Z',
            ),
        ).toBe(true);
    });

    it('페이지·기간 범위 오류는 NOTIFICATION-007, 형식 오류는 COMMON-005다', async () => {
        expect((await get('/v1/admin/notification-jobs', { page: 0 })).data.code).toBe(
            'NOTIFICATION-007',
        );
        expect((await get('/v1/admin/notification-jobs', { size: 101 })).data.code).toBe(
            'NOTIFICATION-007',
        );
        expect(
            (
                await get('/v1/admin/notification-jobs', {
                    from: '2026-10-02T00:00:00Z',
                    to: '2026-10-01T00:00:00Z',
                })
            ).data.code,
        ).toBe('NOTIFICATION-007');
        expect((await get('/v1/admin/notification-jobs', { status: 'UNKNOWN' })).data.code).toBe(
            'COMMON-005',
        );
        expect((await get('/v1/admin/notification-jobs', { from: '2026-10-01' })).data.code).toBe(
            'COMMON-005',
        );
    });

    it('페이지는 1부터 나뉜다', async () => {
        const data = page(
            notificationJobSchema,
            (await get('/v1/admin/notification-jobs', { page: 2, size: 10 })).data,
        );
        expect(data.page).toBe(2);
        expect(data.items).toHaveLength(4);
        expect(data.totalElements).toBe(14);
    });
});

describe('AN02 작업 상세', () => {
    it('상세 전용 필드를 포함해 반환한다', async () => {
        const res = await get(`/v1/admin/notification-jobs/${RETRYABLE_JOB}`);
        expect(res.status).toBe(200);
        const detail = envelopeSchema(notificationJobDetailSchema).parse(res.data).data;
        expect(detail.lastError).toBeTruthy();
        expect(detail).toHaveProperty('sourceJobId');
        expect(detail).toHaveProperty('leaseUntil');
    });

    it('없는 작업은 404 NOTIFICATION-009, UUID가 아니면 400 COMMON-005다', async () => {
        const missing = await get(
            '/v1/admin/notification-jobs/0199c001-9999-7000-8000-000000009999',
        );
        expect(missing.status).toBe(404);
        expect(missing.data.code).toBe('NOTIFICATION-009');

        const bad = await get('/v1/admin/notification-jobs/not-a-uuid');
        expect(bad.status).toBe(400);
        expect(bad.data.code).toBe('COMMON-005');
    });
});

describe('AN03 생성 복구 접수', () => {
    it('최종 실패 작업은 202로 접수되고 대기 상태로 돌아간다', async () => {
        const res = await post(`/v1/admin/notification-jobs/${RETRYABLE_JOB}/retry`);
        expect(res.status).toBe(202);
        const job = envelopeSchema(notificationJobSchema).parse(res.data).data;
        expect(job.status).toBe('PENDING');
        expect(job.retryable).toBe(false);
        expect(job.nextAttemptAt).not.toBeNull();
    });

    it('이미 접수된 재요청은 409 NOTIFICATION-010이다', async () => {
        await post(`/v1/admin/notification-jobs/${RETRYABLE_JOB}/retry`);
        const again = await post(`/v1/admin/notification-jobs/${RETRYABLE_JOB}/retry`);
        expect(again.status).toBe(409);
        expect(again.data.code).toBe('NOTIFICATION-010');
    });

    it('최종 실패가 아니거나 중지·자동 재시도 대기 건은 409다', async () => {
        for (const [id, why] of [
            [COMPLETED_JOB, '완료'],
            [STOPPED_JOB, '중지'],
            [AUTO_RETRY_JOB, '자동 재시도 대기'],
        ] as const) {
            const res = await post(`/v1/admin/notification-jobs/${id}/retry`);
            expect(res.status, why).toBe(409);
            expect(res.data.code, why).toBe('NOTIFICATION-010');
        }
    });

    it('없는 작업은 404 NOTIFICATION-009다', async () => {
        const res = await post(
            '/v1/admin/notification-jobs/0199c001-9999-7000-8000-000000009999/retry',
        );
        expect(res.status).toBe(404);
        expect(res.data.code).toBe('NOTIFICATION-009');
    });
});

describe('AN04 발송 이력 목록', () => {
    it('Page 봉투에 AdminNotification을 담고 최신순으로 반환한다', async () => {
        const res = await get('/v1/admin/notifications');
        expect(res.status).toBe(200);
        const data = page(adminNotificationSchema, res.data);
        expect(data.totalElements).toBe(16);
        const times = data.items.map((n) => n.createdAt);
        expect(times).toEqual([...times].sort().reverse());
        // ADR-028 — 수신자 현재 이름을 싣고, 이름이 없는 건은 null이다
        expect(data.items.find((n) => n.userId === 'vu-doyoon')?.userName).toBe('김도윤');
        expect(data.items.find((n) => n.userId === 'vu-yuna')?.userName).toBeNull();
    });

    it('userId·jobId·mockDeliveryStatus로 거른다', async () => {
        const mine = page(
            adminNotificationSchema,
            (await get('/v1/admin/notifications', { userId: 'vu-doyoon', size: 100 })).data,
        );
        expect(mine.items.every((n) => n.userId === 'vu-doyoon')).toBe(true);

        const byJob = page(
            adminNotificationSchema,
            (
                await get('/v1/admin/notifications', {
                    jobId: '0199c001-0002-7000-8000-000000000002',
                    size: 100,
                })
            ).data,
        );
        expect(byJob.items.length).toBeGreaterThan(0);
        expect(byJob.items.every((n) => n.jobId === '0199c001-0002-7000-8000-000000000002')).toBe(
            true,
        );

        const failed = page(
            adminNotificationSchema,
            (await get('/v1/admin/notifications', { mockDeliveryStatus: 'FAILED', size: 100 }))
                .data,
        );
        expect(failed.items.every((n) => n.mockDeliveryStatus === 'FAILED')).toBe(true);
    });

    it('eventId·기간 필터와 페이지 나누기가 동작한다', async () => {
        const event = page(
            adminNotificationSchema,
            (await get('/v1/admin/notifications', { eventId: 'evt-201', size: 100 })).data,
        );
        expect(event.items.every((n) => n.eventId === 'evt-201')).toBe(true);

        const ranged = page(
            adminNotificationSchema,
            (
                await get('/v1/admin/notifications', {
                    size: 100,
                    from: '2026-10-08T00:00:00Z',
                    to: '2026-10-09T00:00:00Z',
                })
            ).data,
        );
        expect(ranged.items.length).toBeGreaterThan(0);
        expect(ranged.items.every((n) => n.createdAt >= '2026-10-08T00:00:00Z')).toBe(true);

        const second = page(
            adminNotificationSchema,
            (await get('/v1/admin/notifications', { page: 2, size: 10 })).data,
        );
        expect(second.items).toHaveLength(6);
    });
});

describe('AN05 발송 복구 접수', () => {
    it('최종 실패 발송 건은 202로 접수되고 발송 대기로 돌아간다', async () => {
        const res = await post(
            `/v1/admin/notifications/${RETRYABLE_NOTIFICATION}/delivery-retries`,
        );
        expect(res.status).toBe(202);
        const notification = envelopeSchema(adminNotificationSchema).parse(res.data).data;
        expect(notification.mockDeliveryStatus).toBe('PENDING');
        expect(notification.retryable).toBe(false);
        expect(notification.nextDeliveryAttemptAt).not.toBeNull();
        // 같은 알림의 발송만 재시도한다 — 읽음 상태·처리 차수는 보존한다
        expect(notification.isRead).toBe(false);
        expect(notification.deliveryAttemptCount).toBe(4);
    });

    it('이미 접수된 재요청과 정상 발송 건은 409 NOTIFICATION-010이다', async () => {
        await post(`/v1/admin/notifications/${RETRYABLE_NOTIFICATION}/delivery-retries`);
        const again = await post(
            `/v1/admin/notifications/${RETRYABLE_NOTIFICATION}/delivery-retries`,
        );
        expect(again.status).toBe(409);
        expect(again.data.code).toBe('NOTIFICATION-010');

        const sent = await post(`/v1/admin/notifications/${SENT_NOTIFICATION}/delivery-retries`);
        expect(sent.status).toBe(409);
        expect(sent.data.code).toBe('NOTIFICATION-010');
    });

    it('없는 알림은 404 NOTIFICATION-009다', async () => {
        const res = await post(
            '/v1/admin/notifications/0199c101-9999-7000-8000-000000009999/delivery-retries',
        );
        expect(res.status).toBe(404);
        expect(res.data.code).toBe('NOTIFICATION-009');
    });
});
