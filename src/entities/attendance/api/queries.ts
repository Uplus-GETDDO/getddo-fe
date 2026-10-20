import { useQuery } from '@tanstack/react-query';

import { apiClient } from '@shared/api/client';
import { envelopeSchema } from '@shared/api/envelopeSchema';
import {
    pollingReadInterval,
    pollingReadPolicy,
    queryPresets,
    withPollingReadGuard,
} from '@shared/api/queryPresets';

import type { AttendanceToday } from '../model/types';

import { attendanceMonthSchema, attendanceTodaySchema } from '../model/types';

export const ATTENDANCES_KEY = ['attendance'] as const;
export const ATTENDANCE_TODAY_KEY = [...ATTENDANCES_KEY, 'today'] as const;
export const ATTENDANCE_MONTHS_KEY = [...ATTENDANCES_KEY, 'months'] as const;

// 출석 도메인의 엔드포인트 — 출석 처리(POST)를 하는 feature/checkAttendance도 이 상수를 재사용한다
export const ATTENDANCES_API_PATH = '/v1/attendances';
export const ATTENDANCE_TODAY_API_PATH = `${ATTENDANCES_API_PATH}/today`;

/** AT01 — 오늘 출석 여부·연속 일수·일일 보상량·이번 달 단계 */
export function useAttendanceToday() {
    return useQuery<AttendanceToday>({
        ...pollingReadPolicy,
        // 화면을 열어 둔 채 기준일(00:00 KST)이 지나면 어제의 attended가 남아 버튼이 계속 비활성된다 — 주기적으로 다시 받는다
        ...queryPresets.realtime,
        refetchInterval: (query) => pollingReadInterval(query),
        queryKey: ATTENDANCE_TODAY_KEY,
        queryFn: (context) =>
            withPollingReadGuard(context, async () => {
                const { data } = await apiClient.get<unknown>(ATTENDANCE_TODAY_API_PATH, {
                    signal: context.signal,
                });
                return envelopeSchema(attendanceTodaySchema).parse(data).data;
            }),
    });
}

/** AT03 — month는 KST 기준월 'YYYY-MM'이며 필수다. 기록 없는 달은 attendanceDates가 빈 목록 */
export function useAttendanceMonth(month: string, options?: { enabled?: boolean }) {
    return useQuery({
        ...pollingReadPolicy,
        queryKey: [...ATTENDANCE_MONTHS_KEY, month],
        enabled: options?.enabled ?? true,
        queryFn: (context) =>
            withPollingReadGuard(context, async () => {
                const { data } = await apiClient.get<unknown>(ATTENDANCES_API_PATH, {
                    params: { month },
                    signal: context.signal,
                });
                return envelopeSchema(attendanceMonthSchema).parse(data).data;
            }),
    });
}
