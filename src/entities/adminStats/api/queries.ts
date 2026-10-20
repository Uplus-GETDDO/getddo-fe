import { useQuery } from '@tanstack/react-query';
import { z } from 'zod';

import { apiClient } from '@shared/api/client';
import { envelopeSchema } from '@shared/api/envelopeSchema';
import { queryPresets } from '@shared/api/queryPresets';

import { dailyStatsSchema } from '../model/types';

export const ADMIN_STATS_KEY = ['admin', 'stats'] as const;

const ymdSchema = z.iso.date();
export const dailyStatsParamsSchema = z.object({ from: ymdSchema, to: ymdSchema }).refine(
    ({ from, to }) => {
        const diff = (Date.parse(to) - Date.parse(from)) / 86_400_000;
        return diff >= 0 && diff <= 30;
    },
    { message: '기간은 1일 이상 31일 이하여야 하고 시작일이 종료일보다 늦을 수 없습니다.' },
);
export type DailyStatsParams = z.infer<typeof dailyStatsParamsSchema>;

const DAY_MS = 86_400_000;

/** from..to(양끝 포함)의 연속된 날짜 목록 — 응답 days가 빠진 날이나 중복을 숨기지 못하게 대조한다 */
function expectedDates(from: string, to: string): string[] {
    const dates: string[] = [];
    for (let t = Date.parse(from); t <= Date.parse(to); t += DAY_MS) {
        dates.push(new Date(t).toISOString().slice(0, 10));
    }
    return dates;
}

// AS01은 KST 날짜 문자열을 그대로 보낸다 — 이력 조회의 UTC [from,to) 변환을 적용하지 않는다
export function useAdminDailyStats(params: DailyStatsParams) {
    const { from, to } = dailyStatsParamsSchema.parse(params);
    return useQuery({
        ...queryPresets.standard,
        retry: false,
        queryKey: [...ADMIN_STATS_KEY, 'daily', { from, to }],
        queryFn: async () => {
            const { data } = await apiClient.get<unknown>('/v1/admin/stats/daily', {
                params: { from, to },
            });
            const stats = envelopeSchema(dailyStatsSchema).parse(data).data;
            const expected = expectedDates(from, to);
            const actual = stats.days.map((d) => d.date);
            if (actual.length !== expected.length || actual.some((d, i) => d !== expected[i])) {
                throw new Error('일별 집계 응답의 날짜 범위가 요청과 다릅니다.');
            }
            return stats;
        },
    });
}
