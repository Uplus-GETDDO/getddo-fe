import type { DailyStatsDay } from '@entities/adminStats';
import type { TicketSourceType } from '@entities/ticket';

export const TREND_SOURCES: readonly TicketSourceType[] = ['ATTENDANCE', 'MISSION', 'GAME'];

/** 대시보드 그래프 기간 — 최근 7일 고정. AS01 한 번의 조회로 가져온다 */
export const TREND_DAYS = 7;

export interface TrendRow {
    ymd: string;
    /** 축 라벨 "10/16" */
    label: string;
    ATTENDANCE: number;
    MISSION: number;
    GAME: number;
    /** 그날 지급 합계 */
    granted: number;
    /** 그날 응모에 쓴 응모권 수 — 반환을 빼지 않은 총사용량 (AS01 usedTickets) */
    used: number;
}

const axisLabel = (ymd: string) => {
    const [, month, day] = ymd.split('-');
    return `${Number(month)}/${Number(day)}`;
};

// AS01 days → 차트 행. 지급 장수는 세 지급 근거의 합계다 (건수가 아니라 장수)
export function toTrendRows(days: DailyStatsDay[]): TrendRow[] {
    return days.map((day) => {
        const { ATTENDANCE, MISSION, GAME } = day.grantedTickets;
        return {
            ymd: day.date,
            label: axisLabel(day.date),
            ATTENDANCE,
            MISSION,
            GAME,
            granted: ATTENDANCE + MISSION + GAME,
            used: day.usedTickets,
        };
    });
}
