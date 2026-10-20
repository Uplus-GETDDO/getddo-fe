import { useQuery } from '@tanstack/react-query';

import { apiClient } from '@shared/api/client';
import { envelopeSchema, pageSchema } from '@shared/api/envelopeSchema';
import { queryPresets } from '@shared/api/queryPresets';

import type { UserStatus } from '../model/adminUser';
import type { Membership, UserRole } from '../model/types';

import { adminUserSchema } from '../model/adminUser';

export const ADMIN_USERS_KEY = ['admin', 'users'] as const;

export const ADMIN_USERS_API_PATH = '/v1/admin/users';

export interface AdminUsersParams {
    page: number;
    size: number;
    userId?: string;
    /** 이름 부분 검색 — 최대 20자 */
    keyword?: string;
    role?: UserRole;
    status?: UserStatus;
    membership?: Membership;
}

const adminUserPageSchema = envelopeSchema(pageSchema(adminUserSchema));

// AO01 — 관리자 사용자 목록. 생성 시각 최신순이며 totalElements는 필터에 맞는 전체 건수다
export function useAdminUsers(params: AdminUsersParams) {
    return useQuery({
        ...queryPresets.paged,
        queryKey: [...ADMIN_USERS_KEY, params],
        queryFn: async () => {
            const { data } = await apiClient.get<unknown>(ADMIN_USERS_API_PATH, { params });
            return adminUserPageSchema.parse(data).data;
        },
    });
}

// AO01 건수 — size=1로 불러 totalElements만 쓴다. 예: 활성 일반 사용자 수(참여율 분모)
export function useAdminUserCount(params: Omit<AdminUsersParams, 'page' | 'size'>) {
    return useQuery({
        queryKey: [...ADMIN_USERS_KEY, 'count', params],
        staleTime: 60_000,
        queryFn: async () => {
            const { data } = await apiClient.get<unknown>(ADMIN_USERS_API_PATH, {
                params: { ...params, page: 1, size: 1 },
            });
            return adminUserPageSchema.parse(data).data.totalElements;
        },
    });
}
