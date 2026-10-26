import type { AttendanceMilestone } from '@entities/attendance';

export interface NextStreakMilestone {
    /** 단계 일수 — 예: 연속 7일 */
    milestoneDays: number;
    /** 앞으로 더 출석해야 하는 날 수 (오늘 출석 전이면 오늘도 센다) */
    remainingDays: number;
    rewardTicketCount: number;
}

/**
 * 다음 연속 출석 보상 단계 — 아직 받지 않았고 지금 연속 일수보다 큰 단계 중 가장 가까운 것.
 * 연속 출석은 매월 1일에 초기화되므로(getddo-spec attendance.md) 이번 달 안에 닿을 수 없는 단계는 고르지 않는다.
 * daysLeftInMonth: 앞으로 출석할 수 있는 날 수 (오늘 출석 전이면 오늘 포함)
 */
export function nextStreakMilestone(
    milestones: readonly AttendanceMilestone[],
    consecutiveDays: number,
    daysLeftInMonth: number,
): NextStreakMilestone | null {
    const next = [...milestones]
        .filter((m) => !m.claimed && m.milestoneDays > consecutiveDays)
        .sort((a, b) => a.milestoneDays - b.milestoneDays)
        .at(0);
    if (!next) return null;
    const remainingDays = next.milestoneDays - consecutiveDays;
    if (remainingDays > daysLeftInMonth) return null;
    return {
        milestoneDays: next.milestoneDays,
        remainingDays,
        rewardTicketCount: next.rewardTicketCount,
    };
}
