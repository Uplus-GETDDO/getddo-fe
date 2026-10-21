import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRef } from 'react';

import type { DailyPolicyWrite, StreakPolicyWrite } from '@entities/attendance';

import {
    ADMIN_ATTENDANCE_KEY,
    ADMIN_ATTENDANCE_PATH,
    dailyAttendancePolicySchema,
    dailyPolicyWriteSchema,
    streakPolicySetSchema,
    streakPolicyWriteSchema,
} from '@entities/attendance';
import { apiClient } from '@shared/api/client';
import { envelopeSchema } from '@shared/api/envelopeSchema';
import { getPollingRetryDelay } from '@shared/api/queryPresets';

type PolicyRequest =
    { kind: 'daily'; body: DailyPolicyWrite } | { kind: 'streak'; body: StreakPolicyWrite };
type PolicyUpdateRequest = PolicyRequest & { id: string };
export function useCreateAttendancePolicy() {
    const client = useQueryClient();
    const busy = useRef(false);
    const lastError = useRef<unknown>(null);
    return useMutation({
        retry: false,
        mutationFn: async (request: PolicyRequest) => {
            if (busy.current) throw new Error('정책 예약 처리 중입니다.');
            if (getPollingRetryDelay(lastError.current) > 0) throw lastError.current;
            busy.current = true;
            try {
                const body =
                    request.kind === 'daily'
                        ? dailyPolicyWriteSchema.parse(request.body)
                        : streakPolicyWriteSchema.parse(request.body);
                const { data } = await apiClient.post<unknown>(
                    `${ADMIN_ATTENDANCE_PATH}/${request.kind}`,
                    body,
                );
                return request.kind === 'daily'
                    ? envelopeSchema(dailyAttendancePolicySchema).parse(data).data
                    : envelopeSchema(streakPolicySetSchema).parse(data).data;
            } catch (error) {
                lastError.current = error;
                getPollingRetryDelay(error);
                throw error;
            } finally {
                busy.current = false;
            }
        },
        onSettled: () => client.invalidateQueries({ queryKey: ADMIN_ATTENDANCE_KEY }),
    });
}
/**
 * 예약 정책 수정 (AP05·AP06) — 아직 시작하지 않은 정책만 바꿀 수 있고,
 * 이미 시작한 정책은 서버가 409 `ATTENDANCE-007`로 거절한다. 적용 시점은 바뀌지 않는다
 */
export function useUpdateAttendancePolicy() {
    const client = useQueryClient();
    const busy = useRef(false);
    const lastError = useRef<unknown>(null);
    return useMutation({
        retry: false,
        mutationFn: async (request: PolicyUpdateRequest) => {
            if (busy.current) throw new Error('정책 수정 처리 중입니다.');
            if (getPollingRetryDelay(lastError.current) > 0) throw lastError.current;
            busy.current = true;
            try {
                const body =
                    request.kind === 'daily'
                        ? dailyPolicyWriteSchema.parse(request.body)
                        : streakPolicyWriteSchema.parse(request.body);
                const { data } = await apiClient.put<unknown>(
                    `${ADMIN_ATTENDANCE_PATH}/${request.kind}/${request.id}`,
                    body,
                );
                return request.kind === 'daily'
                    ? envelopeSchema(dailyAttendancePolicySchema).parse(data).data
                    : envelopeSchema(streakPolicySetSchema).parse(data).data;
            } catch (error) {
                lastError.current = error;
                getPollingRetryDelay(error);
                throw error;
            } finally {
                busy.current = false;
            }
        },
        onSettled: () => client.invalidateQueries({ queryKey: ADMIN_ATTENDANCE_KEY }),
    });
}
