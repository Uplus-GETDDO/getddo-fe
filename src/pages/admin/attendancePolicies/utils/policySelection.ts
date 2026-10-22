import type { DailyAttendancePolicy, StreakPolicySet } from '@entities/attendance';

interface PolicySelection<T> {
    current: T | null;
    scheduled: T | null;
}

// 경계 포함(<=): 적용 시작 정각의 정책은 이미 시작된 것으로 본다
export const selectDailyAttendancePolicies = (
    policies: DailyAttendancePolicy[],
    now: Date,
): PolicySelection<DailyAttendancePolicy> => {
    const nowMs = now.getTime();
    let current: DailyAttendancePolicy | null = null;
    let currentMs = Number.NEGATIVE_INFINITY;
    let scheduled: DailyAttendancePolicy | null = null;
    let scheduledMs = Number.POSITIVE_INFINITY;
    for (const policy of policies) {
        const fromMs = new Date(policy.effectiveFrom).getTime();
        if (fromMs <= nowMs) {
            if (fromMs > currentMs) {
                current = policy;
                currentMs = fromMs;
            }
        } else if (fromMs < scheduledMs) {
            scheduled = policy;
            scheduledMs = fromMs;
        }
    }
    return { current, scheduled };
};

// effectiveMonth는 'YYYY-MM' 형식이라 문자열 비교가 시간 비교와 일치한다 (연도 넘김 포함)
export const selectStreakPolicySets = (
    sets: StreakPolicySet[],
    kstMonth: string,
): PolicySelection<StreakPolicySet> => {
    let current: StreakPolicySet | null = null;
    let scheduled: StreakPolicySet | null = null;
    for (const set of sets) {
        if (set.effectiveMonth <= kstMonth) {
            if (!current || set.effectiveMonth > current.effectiveMonth) {
                current = set;
            }
        } else if (!scheduled || set.effectiveMonth < scheduled.effectiveMonth) {
            scheduled = set;
        }
    }
    return { current, scheduled };
};
