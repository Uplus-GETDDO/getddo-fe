import { describe, expect, it } from 'vitest';

import { apiClient } from '@shared/api/client';

// 세션 스토어 상태와 무관하게 계약만 검증하기 위해 사용자 문맥 헤더를 직접 붙인다
const USER = { headers: { 'X-User-ID': 'user-test-1' } };

function list(params?: Record<string, unknown>) {
    return apiClient.get('/v1/notifications/me', {
        ...USER,
        params,
        validateStatus: () => true,
    });
}

interface Envelope<T> {
    success: boolean;
    code: string;
    data: T;
}

interface NotificationItem {
    id: string;
    isRead: boolean;
    createdAt: string;
}

interface NotificationCursor {
    items: NotificationItem[];
    nextCursor: string | null;
    totalElements: number;
}

describe('알림 목업 핸들러 (N01~N03 확정 계약)', () => {
    it('목록은 봉투와 커서 형식으로 반환한다', async () => {
        const res = await list();
        const body = res.data as Envelope<NotificationCursor>;

        expect(res.status).toBe(200);
        expect(body.success).toBe(true);
        expect(body.code).toBe('SUCCESS');
        expect(body.data).toHaveProperty('nextCursor');
        expect(body.data).toHaveProperty('totalElements');
        expect(body.data.items[0]).toHaveProperty('isRead');
        // 정렬 createdAt DESC
        const dates = body.data.items.map((i) => i.createdAt);
        expect(dates).toEqual([...dates].sort().reverse());
    });

    it('size를 넘는 목록은 nextCursor로 이어서 조회한다', async () => {
        const first = (await list({ size: 2 })).data as Envelope<NotificationCursor>;

        expect(first.data.items).toHaveLength(2);
        expect(first.data.nextCursor).not.toBeNull();

        const second = (await list({ size: 2, cursor: first.data.nextCursor }))
            .data as Envelope<NotificationCursor>;
        const firstIds = new Set(first.data.items.map((i) => i.id));
        expect(second.data.items.every((i) => !firstIds.has(i.id))).toBe(true);
    });

    it('isRead 필터와 size 범위 위반 400 NOTIFICATION-001을 처리한다', async () => {
        const unread = (await list({ isRead: false })).data as Envelope<NotificationCursor>;
        expect(unread.data.items.every((i) => !i.isRead)).toBe(true);

        const bad = await list({ size: 0 });
        expect(bad.status).toBe(400);
        expect((bad.data as Envelope<null>).code).toBe('NOTIFICATION-001');
    });

    it('없는 알림은 404 NOTIFICATION-002, 헤더 없으면 401 USER-003다', async () => {
        const missing = await apiClient.put('/v1/notifications/not-exist/read', undefined, {
            ...USER,
            validateStatus: () => true,
        });
        expect(missing.status).toBe(404);
        expect((missing.data as Envelope<null>).code).toBe('NOTIFICATION-002');

        const noUser = await apiClient.get('/v1/notifications/me', {
            validateStatus: () => true,
        });
        expect(noUser.status).toBe(401);
        expect((noUser.data as Envelope<null>).code).toBe('USER-003');
    });

    it('읽음 상태는 X-User-ID별로 분리된다', async () => {
        const OTHER = { headers: { 'X-User-ID': 'user-test-3' } };

        await apiClient.put('/v1/notifications/me/read-all', undefined, OTHER);

        const otherUnread = (
            await apiClient.get('/v1/notifications/me', {
                ...OTHER,
                params: { isRead: false },
                validateStatus: () => true,
            })
        ).data as Envelope<NotificationCursor>;
        expect(otherUnread.data.items).toHaveLength(0);

        // 다른 사용자의 전체 읽음이 내 미읽음 목록에 영향을 주지 않는다
        const mine = (await list({ isRead: false })).data as Envelope<NotificationCursor>;
        expect(mine.data.items.length).toBeGreaterThan(0);
    });

    // 읽음 처리는 목업 상태를 변경하므로 파일 내 마지막에 둔다
    it('개별 읽음과 전체 읽음을 처리한다', async () => {
        const { items } = ((await list({ isRead: false })).data as Envelope<NotificationCursor>)
            .data;
        const target = items[0];
        if (!target) throw new Error('목업에 미읽음 알림이 없습니다');

        const read = await apiClient.put(`/v1/notifications/${target.id}/read`, undefined, USER);
        expect((read.data as Envelope<{ id: string; isRead: boolean }>).data).toEqual({
            id: target.id,
            isRead: true,
        });

        const all = await apiClient.put('/v1/notifications/me/read-all', undefined, USER);
        expect(
            (all.data as Envelope<{ updatedCount: number }>).data.updatedCount,
        ).toBeGreaterThanOrEqual(0);

        const after = (await list({ isRead: false })).data as Envelope<NotificationCursor>;
        expect(after.data.items).toHaveLength(0);
    });
});
