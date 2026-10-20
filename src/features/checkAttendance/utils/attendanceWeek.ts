import type { AttendanceMilestone } from '@entities/attendance';

import { formatYmd, toKst } from '@shared/utils/date';

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEKDAY_LABELS = ['일', '월', '화', '수', '목', '금', '토'];

export interface AttendanceDay {
    /** 출석 기준일(KST 날짜, YYYY-MM-DD) */
    date: string;
    label: string;
    isToday: boolean;
    checked: boolean;
}

/** 출석 기준일은 00:00 KST에 바뀌므로 KST 날짜로 키를 만든다 (getddo-spec 공통 시간 기준) */
export function toAttendanceDate(date: Date): string {
    return formatYmd(date.toISOString());
}

/** 오늘을 마지막 칸으로 하는 최근 7일의 출석 여부를 만든다 */
export function buildAttendanceWeek(
    checkedDates: string[],
    attended: boolean,
    now: Date,
): AttendanceDay[] {
    const checked = new Set(checkedDates);
    const today = toAttendanceDate(now);

    return Array.from({ length: 7 }, (_, index) => {
        const day = new Date(now.getTime() - (6 - index) * DAY_MS);
        const date = toAttendanceDate(day);
        const isToday = date === today;
        return {
            date,
            label: isToday ? '오늘' : (WEEKDAY_LABELS[toKst(day).getUTCDay()] ?? ''),
            isToday,
            checked: checked.has(date) || (isToday && attended),
        };
    });
}

/** 이번 달(KST 기준월) 출석일수 — 연속 출석과 같은 기준월로 센다 */
export function countMonthlyAttendance(
    checkedDates: string[],
    attended: boolean,
    now: Date,
): number {
    const today = toAttendanceDate(now);
    const month = today.slice(0, 7);
    const dates = new Set(checkedDates.filter((date) => date.startsWith(month)));
    if (attended) dates.add(today);
    return dates.size;
}

export interface AttendanceMonthDay {
    /** 출석 기준일(KST 날짜, YYYY-MM-DD) */
    date: string;
    /** 달력에 표시할 일(1~31) */
    day: number;
    isToday: boolean;
    /** 아직 오지 않은 날 — 오늘 이후 */
    isFuture: boolean;
    checked: boolean;
}

/** 이번 달(KST 기준월) 1일부터 말일까지의 출석 여부를 만든다 */
export function buildAttendanceMonth(
    checkedDates: string[],
    attended: boolean,
    now: Date,
): AttendanceMonthDay[] {
    const checked = new Set(checkedDates);
    const today = toAttendanceDate(now);
    const kstNow = toKst(now);
    const year = kstNow.getUTCFullYear();
    const month = kstNow.getUTCMonth();
    const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();

    return Array.from({ length: lastDay }, (_, index) => {
        const date = formatYmd(new Date(Date.UTC(year, month, index + 1)).toISOString());
        const isToday = date === today;
        return {
            date,
            day: index + 1,
            isToday,
            // YYYY-MM-DD 문자열은 사전순이 곧 날짜순이다
            isFuture: date > today,
            checked: checked.has(date) || (isToday && attended),
        };
    });
}

/**
 * 연속 출석 보상을 받은 출석 기준일 → 그날 받은 추가 응모권 수.
 * 보상은 날짜(7·14·28일)가 아니라 연속 일수로 주어 사람마다 받는 날이 달라, 실제로 받은 날만 판에 표시한다
 */
export function claimedStreakBonuses(
    milestones: readonly AttendanceMilestone[],
): Map<string, number> {
    const bonuses = new Map<string, number>();
    for (const milestone of milestones) {
        if (!milestone.claimed || !milestone.claimedAt) continue;
        const date = toAttendanceDate(new Date(milestone.claimedAt));
        bonuses.set(date, (bonuses.get(date) ?? 0) + milestone.rewardTicketCount);
    }
    return bonuses;
}

/** 출석 기준일(YYYY-MM-DD)이 연속 출석 보상을 받은 날인지 */
export function isStreakBonusDate(date: string, bonusDates: ReadonlySet<string>): boolean {
    return bonusDates.has(date);
}

/**
 * 보상일에 보여줄 캐릭터 번호를 고른다.
 * 달마다 시작 순서를 섞되(같은 달은 항상 같은 결과), 한 달 안의 보상일끼리는 겹치지 않게 차례로 배정한다
 */
export function pickBonusMascotIndex(
    date: string,
    bonusDates: ReadonlySet<string>,
    count: number,
): number {
    const month = date.slice(0, 7);
    const seed = [...month].reduce((sum, char) => (sum * 31 + char.charCodeAt(0)) % 9973, 7);
    // YYYY-MM-DD 문자열은 사전순이 곧 날짜순이다
    const order = [...bonusDates]
        .filter((bonusDate) => bonusDate.startsWith(month))
        .sort()
        .indexOf(date);
    return (seed + Math.max(order, 0)) % count;
}
