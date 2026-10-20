import type { UserRole, UserStatus } from '@entities/user';

export const USER_ROLE_LABEL: Record<UserRole, string> = {
    USER: '사용자',
    ADMIN: '관리자',
};

export const USER_STATUS_LABEL: Record<UserStatus, string> = {
    ACTIVE: '활성',
    INACTIVE: '비활성',
};
