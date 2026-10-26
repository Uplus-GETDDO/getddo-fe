import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { z } from 'zod';

import { apiClient } from '@shared/api/client';
import { envelopeSchema, pageSchema } from '@shared/api/envelopeSchema';
import { queryPresets } from '@shared/api/queryPresets';

import {
    adminUserSchema,
    membershipSchema,
    userRoleSchema,
    userStatusSchema,
} from '../model/types';

export const ADMIN_USERS_KEY = ['admin', 'users'] as const;
export const adminUsersParamsSchema = z.object({
    page: z.number().int().min(1),
    size: z.number().int().min(1).max(100),
    userId: z.uuid().optional(),
    keyword: z.string().trim().max(20).optional(),
    role: userRoleSchema.optional(),
    status: userStatusSchema.optional(),
    membership: membershipSchema.optional(),
});
export type AdminUsersParams = z.infer<typeof adminUsersParamsSchema>;
export const adminUserListSchema = pageSchema(adminUserSchema).extend({
    totalUserCount: z.number().int().nonnegative(),
});
export type AdminUserList = z.infer<typeof adminUserListSchema>;

export function useAdminUsers(params: AdminUsersParams) {
    return useQuery({
        ...queryPresets.noCache,
        retry: false,
        queryKey: [...ADMIN_USERS_KEY, 'list', params],
        // 필터·페이지를 바꿔 다시 받는 동안 이전 목록을 그대로 두어 표가 스켈레톤으로 꺼졌다 켜지지 않게 한다
        placeholderData: keepPreviousData,
        queryFn: async () => {
            const { data } = await apiClient.get<unknown>('/v1/admin/users', {
                params: adminUsersParamsSchema.parse(params),
            });
            return envelopeSchema(adminUserListSchema).parse(data).data;
        },
    });
}

export function useAdminUser(userId: string | null) {
    return useQuery({
        ...queryPresets.noCache,
        retry: false,
        queryKey: [...ADMIN_USERS_KEY, 'detail', userId],
        enabled: !!userId && z.uuid().safeParse(userId).success,
        queryFn: async () => {
            const { data } = await apiClient.get<unknown>(
                `/v1/admin/users/${encodeURIComponent(userId!)}`,
            );
            return envelopeSchema(adminUserSchema).parse(data).data;
        },
    });
}
