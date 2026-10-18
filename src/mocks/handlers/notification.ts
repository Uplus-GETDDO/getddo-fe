import { http } from 'msw';

import type { Notification } from '@entities/notification';

import { env } from '@shared/config/env';

import { fail, ok } from './response';

const api = (path: string) => `${env.apiBaseUrl}${path}`;
const DEFAULT_SIZE = 20;

// N01~N03 확정 계약(getddo-spec/05-api/notification.md) 기준 목업 — createdAt 내림차순이 기본 상태다
// 원본은 템플릿으로만 쓰고 읽음 상태는 X-User-ID별로 분리한다 (한 사용자의 읽음이 타인 목록을 바꾸지 않도록)
const initialNotifications: Notification[] = [
    {
        id: '3f4a1b2c-0001-4000-8000-000000000001',
        title: '무너 한정 굿즈 타임 래플 오픈 예정',
        body: '15:00에 무너 한정 굿즈 타임 래플이 오픈될 예정이에요.',
        isRead: false,
        createdAt: '2026-09-30T06:00:00Z',
        eventId: 'evt-004',
        linkUrl: '/time-raffle',
    },
    {
        id: '3f4a1b2c-0002-4000-8000-000000000002',
        title: '당첨자 발표 안내',
        // 결과 발표 알림은 당첨·낙첨을 담지 않고 결과 화면으로 안내한다 (getddo-spec 02-domain/notification.md). 드로어 테스트가 이동 없이 읽음 처리만 보도록 링크는 비워 둔다
        body: '무너 한정 굿즈 타임 래플 결과가 발표됐어요. 결과 화면에서 당첨 여부를 확인해 보세요.',
        isRead: false,
        createdAt: '2026-09-29T02:00:00Z',
        eventId: null,
        linkUrl: null,
    },
    {
        id: '3f4a1b2c-0003-4000-8000-000000000003',
        title: '응모권 지급 안내',
        body: '출석 체크로 응모권 1장이 지급되었습니다.',
        isRead: true,
        createdAt: '2026-09-28T00:10:00Z',
        eventId: null,
        linkUrl: null,
    },
    {
        id: '3f4a1b2c-0004-4000-8000-000000000004',
        title: '이벤트 시작 알림',
        body: '아이폰 17 프로 타임 래플 응모가 시작되었습니다.',
        isRead: false,
        createdAt: '2026-09-27T09:00:00Z',
        eventId: 'evt-001',
        linkUrl: '/events/evt-001',
    },
];

const notificationsByUser = new Map<string, Notification[]>();

const getNotificationsForUser = (userId: string): Notification[] => {
    const existing = notificationsByUser.get(userId);
    if (existing) return existing;

    const created = initialNotifications.map((notification) => ({ ...notification }));
    notificationsByUser.set(userId, created);
    return created;
};

export const notificationHandlers = [
    http.get(api('/v1/notifications/me'), ({ request }) => {
        const userId = request.headers.get('X-User-ID');
        if (!userId) return fail(401, 'USER-003', '사용자 문맥이 필요합니다.');
        const notifications = getNotificationsForUser(userId);

        const url = new URL(request.url);
        const size = Number(url.searchParams.get('size') ?? DEFAULT_SIZE);
        const isRead = url.searchParams.get('isRead');
        const cursor = url.searchParams.get('cursor');

        if (!Number.isInteger(size) || size < 1 || size > 100) {
            return fail(400, 'NOTIFICATION-001', 'size 범위를 확인해주세요.');
        }

        const filtered = notifications.filter((n) =>
            isRead === null ? true : n.isRead === (isRead === 'true'),
        );
        // 커서는 마지막 반환 항목 id — 클라이언트가 해석하지 않는 불투명 값이지만 목업은 id로 충분하다
        const start = cursor ? filtered.findIndex((n) => n.id === cursor) + 1 : 0;
        const items = filtered.slice(start, start + size);
        const nextCursor = start + size < filtered.length ? (items.at(-1)?.id ?? null) : null;

        return ok({ items, nextCursor, totalElements: filtered.length });
    }),

    http.put(api('/v1/notifications/:notificationId/read'), ({ request, params }) => {
        const userId = request.headers.get('X-User-ID');
        if (!userId) return fail(401, 'USER-003', '사용자 문맥이 필요합니다.');
        const notifications = getNotificationsForUser(userId);

        const target = notifications.find((n) => n.id === params.notificationId);
        if (!target) return fail(404, 'NOTIFICATION-002', '알림을 찾을 수 없습니다.');

        target.isRead = true;
        return ok({ id: target.id, isRead: true });
    }),

    http.put(api('/v1/notifications/me/read-all'), ({ request }) => {
        const userId = request.headers.get('X-User-ID');
        if (!userId) return fail(401, 'USER-003', '사용자 문맥이 필요합니다.');
        const notifications = getNotificationsForUser(userId);

        const updatedCount = notifications.filter((n) => !n.isRead).length;
        notifications.forEach((n) => {
            n.isRead = true;
        });
        return ok({ updatedCount });
    }),
];
