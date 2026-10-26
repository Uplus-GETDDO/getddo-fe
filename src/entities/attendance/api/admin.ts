import { keepPreviousData, useQuery } from '@tanstack/react-query';

import { apiClient } from '@shared/api/client';
import { envelopeSchema, pageSchema } from '@shared/api/envelopeSchema';
import { pollingReadPolicy, withPollingReadGuard } from '@shared/api/queryPresets';

import { dailyAttendancePolicySchema, streakPolicySetSchema } from '../model/adminTypes';

export const ADMIN_ATTENDANCE_KEY = ['adminAttendancePolicies'] as const;
export const ADMIN_ATTENDANCE_PATH = '/v1/admin/policies/attendance';
export function useDailyAttendancePolicies(page: number) {
    return useQuery({
        ...pollingReadPolicy,
        queryKey: [...ADMIN_ATTENDANCE_KEY, 'daily', page],
        // 필터·페이지를 바꿔 다시 받는 동안 이전 목록을 그대로 두어 표가 스켈레톤으로 꺼졌다 켜지지 않게 한다
        placeholderData: keepPreviousData,
        queryFn: (context) =>
            withPollingReadGuard(context, async () => {
                const { data } = await apiClient.get<unknown>(`${ADMIN_ATTENDANCE_PATH}/daily`, {
                    params: { page, size: 20 },
                    signal: context.signal,
                });
                return envelopeSchema(pageSchema(dailyAttendancePolicySchema)).parse(data).data;
            }),
    });
}
export function useStreakPolicies(page: number) {
    return useQuery({
        ...pollingReadPolicy,
        queryKey: [...ADMIN_ATTENDANCE_KEY, 'streak', page],
        placeholderData: keepPreviousData,
        queryFn: (context) =>
            withPollingReadGuard(context, async () => {
                const { data } = await apiClient.get<unknown>(`${ADMIN_ATTENDANCE_PATH}/streak`, {
                    params: { page, size: 20 },
                    signal: context.signal,
                });
                return envelopeSchema(pageSchema(streakPolicySetSchema)).parse(data).data;
            }),
    });
}
