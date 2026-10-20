import { http } from 'msw';

import type { AdminUser } from '@entities/user';

import { env } from '@shared/config/env';

import { fail, ok } from './response';

const api = (path: string) => `${env.apiBaseUrl}${path}`;

const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

// AO01/AO02 목업 — 배포 표본과 같은 형태로 활성 일반 사용자 12명 + 비활성 관리자 1명을 둔다.
// totalUserCount는 필터·페이지와 무관하게 role=USER AND status=ACTIVE 전체 수(12)다.
const mkUser = (
    n: number,
    name: string,
    role: AdminUser['role'],
    status: AdminUser['status'],
    membership: AdminUser['membership'],
): AdminUser => ({
    id: uuid(n),
    name,
    role,
    status,
    membership,
    createdAt: '2026-09-01T00:00:00Z',
    updatedAt: '2026-10-01T00:00:00Z',
});

const adminUsers: AdminUser[] = [
    mkUser(1, '김도윤', 'USER', 'ACTIVE', 'excellent'),
    mkUser(2, '박서연', 'USER', 'ACTIVE', 'vip'),
    mkUser(3, '이하늘', 'USER', 'ACTIVE', 'vvip'),
    mkUser(4, '최민준', 'USER', 'ACTIVE', 'excellent'),
    mkUser(5, '정지우', 'USER', 'ACTIVE', 'vip'),
    mkUser(6, '한유나', 'USER', 'ACTIVE', null),
    mkUser(7, '강태오', 'USER', 'ACTIVE', 'excellent'),
    mkUser(8, '윤채원', 'USER', 'ACTIVE', 'vvip'),
    mkUser(9, '신재민', 'USER', 'ACTIVE', null),
    mkUser(10, '오은서', 'USER', 'ACTIVE', 'vip'),
    mkUser(11, '임도현', 'USER', 'ACTIVE', 'excellent'),
    mkUser(12, '송민아', 'USER', 'ACTIVE', 'vvip'),
    mkUser(100, '관리자', 'ADMIN', 'ACTIVE', null),
];

const totalUserCount = adminUsers.filter((u) => u.role === 'USER' && u.status === 'ACTIVE').length;

export const adminUserHandlers = [
    http.get(api('/v1/admin/users'), ({ request }) => {
        const params = new URL(request.url).searchParams;
        const userId = params.get('userId');
        const keyword = params.get('keyword')?.trim();
        const role = params.get('role');
        const status = params.get('status');
        const membership = params.get('membership');
        const page = Math.max(1, Number(params.get('page') ?? 1));
        const size = Math.min(100, Math.max(1, Number(params.get('size') ?? 20)));

        const filtered = adminUsers.filter(
            (u) =>
                (!userId || u.id === userId) &&
                (!keyword || u.name.includes(keyword) || u.id === keyword) &&
                (!role || u.role === role) &&
                (!status || u.status === status) &&
                (!membership || u.membership === membership),
        );
        return ok({
            items: filtered.slice((page - 1) * size, page * size),
            page,
            size,
            totalElements: filtered.length,
            totalUserCount,
        });
    }),
    http.get(api('/v1/admin/users/:userId'), ({ params }) => {
        const user = adminUsers.find((u) => u.id === params.userId);
        if (!user) return fail(404, 'USER-010', '사용자를 찾을 수 없습니다.');
        return ok(user);
    }),
];
