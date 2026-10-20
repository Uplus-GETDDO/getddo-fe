import { z } from 'zod';

import { membershipSchema, userRoleSchema } from './types';

// AO01·AO02 관리자 사용자 조회 — getddo-spec 05-api/user.md (2026-10-15 확정)
export const userStatusSchema = z.enum(['ACTIVE', 'INACTIVE']);

export const adminUserSchema = z.object({
    id: z.string(),
    name: z.string(),
    role: userRoleSchema,
    status: userStatusSchema,
    // 관리자는 멤버십이 없을 수 있다
    membership: membershipSchema.nullable(),
    createdAt: z.iso.datetime({ offset: true }),
    updatedAt: z.iso.datetime({ offset: true }),
});

export type UserStatus = z.infer<typeof userStatusSchema>;
export type AdminUser = z.infer<typeof adminUserSchema>;
