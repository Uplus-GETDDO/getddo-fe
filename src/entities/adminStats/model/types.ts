import { z } from 'zod';

// AS01 일별 집계 (getddo-spec/05-api/admin-stats.md — R1 구현, 담당자 확인 전).
// blockedCount는 '탐지 기록 수'이며 지급 차단 확정 건수가 아니다. usedTickets는 반환을 빼지 않은 총사용량.
// totalUserCount는 조회 시점의 활성 일반 사용자 수로 날짜별 값이 아니다.
export const dailyStatsDaySchema = z.object({
    date: z.iso.date(),
    entrantCount: z.number().int().nonnegative(),
    entryCount: z.number().int().nonnegative(),
    activeUserCount: z.number().int().nonnegative(),
    grantedTickets: z.object({
        ATTENDANCE: z.number().int().nonnegative(),
        MISSION: z.number().int().nonnegative(),
        GAME: z.number().int().nonnegative(),
    }),
    usedTickets: z.number().int().nonnegative(),
    blockedCount: z.number().int().nonnegative(),
});

export const dailyStatsSchema = z.object({
    days: z.array(dailyStatsDaySchema),
    totalUserCount: z.number().int().nonnegative(),
});

export type DailyStatsDay = z.infer<typeof dailyStatsDaySchema>;
export type DailyStats = z.infer<typeof dailyStatsSchema>;
