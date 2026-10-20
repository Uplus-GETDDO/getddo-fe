import { http } from 'msw';

import type { AdminUser, Membership } from '@entities/user';

import { env } from '@shared/config/env';

import { MOCK_ADMIN_USERS } from './adminTicket';
import { MOCK_GENERATED_USERS } from './mockUsers';
import { fail, ok } from './response';
import { findMockVirtualUser } from './virtualUsers';

/*
 * 관리자 사용자 조회 목업 — AO01·AO02 (getddo-spec 05-api/user.md, 2026-10-15 확정).
 * 배포 서버에 구현되어 있어 하이브리드 목업에는 넣지 않는다.
 * 응모권 목업의 사용자 위에 생성 사용자(mockUsers)를 더한다 — 응모권 지급 추이도 같은 사람을 쓴다
 */
const api = (path: string) => `${env.apiBaseUrl}${path}`;

const MEMBERSHIPS: Membership[] = ['excellent', 'vip', 'vvip'];
const BASE_TIME = Date.parse('2026-09-01T00:00:00Z');
const HOUR_MS = 3_600_000;

const at = (hours: number) => new Date(BASE_TIME + hours * HOUR_MS).toISOString();

function buildUsers(): AdminUser[] {
    const known: AdminUser[] = MOCK_ADMIN_USERS.map((user, index) => {
        const virtual = findMockVirtualUser(user.id);
        return {
            id: user.id,
            name: user.name,
            role: virtual?.role ?? 'USER',
            status: 'ACTIVE',
            membership: virtual?.membership ?? 'excellent',
            createdAt: at(index),
            updatedAt: at(index),
        };
    });
    const admin = findMockVirtualUser('vu-admin');
    if (admin) {
        known.push({
            id: admin.id,
            name: admin.name,
            role: 'ADMIN',
            status: 'ACTIVE',
            membership: null,
            createdAt: at(known.length),
            updatedAt: at(known.length),
        });
    }
    const generated = MOCK_GENERATED_USERS.map((user, index): AdminUser => {
        const createdAt = at(24 + index * 6);
        return {
            id: user.id,
            name: user.name,
            role: 'USER',
            status: user.active ? 'ACTIVE' : 'INACTIVE',
            membership: user.membership,
            createdAt,
            updatedAt: createdAt,
        };
    });
    return [...known, ...generated];
}

const users = buildUsers();

const badQuery = () => fail(400, 'USER-008', '사용자 조회 조건이 올바르지 않습니다.');

// 공통 사용자 문맥 확인 뒤 활성 관리자만 통과시킨다
function adminGate(request: Request) {
    const userId = request.headers.get('X-User-ID');
    const role = request.headers.get('X-User-Role');
    if (!userId || !role) return fail(401, 'USER-003', '사용자 문맥이 필요합니다.');
    if (role !== 'ADMIN') {
        return fail(403, 'USER-009', '활성 관리자만 사용자 정보를 조회할 수 있습니다.');
    }
    return null;
}

const ROLES = new Set(['USER', 'ADMIN']);
const STATUSES = new Set(['ACTIVE', 'INACTIVE']);

export const adminUserHandlers = [
    // AO01 — 필터는 AND, 정렬은 createdAt DESC·id DESC. keyword는 양끝 공백을 뺀 이름 부분 검색(최대 20자)
    http.get(api('/v1/admin/users'), ({ request }) => {
        const denied = adminGate(request);
        if (denied) return denied;
        const params = new URL(request.url).searchParams;
        const role = params.get('role');
        const status = params.get('status');
        const membership = params.get('membership');
        if (
            (role && !ROLES.has(role)) ||
            (status && !STATUSES.has(status)) ||
            (membership && !MEMBERSHIPS.includes(membership as Membership))
        ) {
            return fail(400, 'COMMON-005', '요청 형식이 올바르지 않습니다.');
        }
        const rawPage = params.get('page') ?? '1';
        const rawSize = params.get('size') ?? '20';
        if (!/^\d+$/.test(rawPage) || !/^\d+$/.test(rawSize)) {
            return fail(400, 'COMMON-005', '요청 형식이 올바르지 않습니다.');
        }
        const page = Number(rawPage);
        const size = Number(rawSize);
        const keyword = params.get('keyword')?.trim() ?? '';
        if (page < 1 || size < 1 || size > 100 || keyword.length > 20) return badQuery();
        const userId = params.get('userId');

        const rows = users
            .filter(
                (user) =>
                    (!userId || user.id === userId) &&
                    (!keyword || user.name.includes(keyword)) &&
                    (!role || user.role === role) &&
                    (!status || user.status === status) &&
                    (!membership || user.membership === membership),
            )
            .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id));
        return ok({
            items: rows.slice((page - 1) * size, page * size),
            page,
            size,
            totalElements: rows.length,
        });
    }),

    // AO02 — 없는 사용자는 404 USER-010
    http.get(api('/v1/admin/users/:userId'), ({ request, params }) => {
        const denied = adminGate(request);
        if (denied) return denied;
        const user = users.find((row) => row.id === String(params.userId));
        return user ? ok(user) : fail(404, 'USER-010', '사용자를 찾을 수 없습니다.');
    }),
];
