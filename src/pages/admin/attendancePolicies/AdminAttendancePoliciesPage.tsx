import { useState } from 'react';

import type { PolicyEditTarget } from '@features/manageAttendancePolicy';

import { useDailyAttendancePolicies, useStreakPolicies } from '@entities/attendance';
import { AttendancePolicyEditDialog } from '@features/manageAttendancePolicy';
import { useVirtualClock } from '@shared/model/virtualClock';
import { formatYmd } from '@shared/utils/date';

import { AttendancePolicySection } from './ui/AttendancePolicySection';
import { DailyPolicySummary, StreakPolicySummary } from './ui/AttendancePolicySummary';
import { selectDailyAttendancePolicies, selectStreakPolicySets } from './utils/policySelection';

export function AdminAttendancePoliciesPage() {
    const [editing, setEditing] = useState<PolicyEditTarget | null>(null);
    // 예약은 적용일·기준월당 최대 1건이라 첫 페이지에 현재·예약이 모두 포함된다
    const daily = useDailyAttendancePolicies(1);
    const streak = useStreakPolicies(1);
    const now = useVirtualClock().now();
    // 표시용 사전 판정 — 최종 판단은 서버(409 ATTENDANCE-007)가 한다
    const kstMonth = formatYmd(now.toISOString()).slice(0, 7);
    const dailySelection = selectDailyAttendancePolicies(daily.data?.items ?? [], now);
    const streakSelection = selectStreakPolicySets(streak.data?.items ?? [], kstMonth);
    return (
        <div className="flex flex-col gap-10 pr-10 pb-10">
            <AttendancePolicySection
                kind="daily"
                title="일일 출석"
                description="하루 첫 출석에 주는 응모권"
                current={dailySelection.current}
                scheduled={dailySelection.scheduled}
                query={daily}
                onEdit={(policy) => setEditing({ kind: 'daily', policy })}
                renderPolicy={(policy) => <DailyPolicySummary policy={policy} />}
            />
            <AttendancePolicySection
                kind="streak"
                title="월간 연속 출석"
                description="한 달 안에 며칠 연속 출석하면 주는 응모권"
                current={streakSelection.current}
                scheduled={streakSelection.scheduled}
                query={streak}
                onEdit={(policy) => setEditing({ kind: 'streak', policy })}
                renderPolicy={(policy) => <StreakPolicySummary policy={policy} />}
            />
            {editing && (
                <AttendancePolicyEditDialog target={editing} onClose={() => setEditing(null)} />
            )}
        </div>
    );
}
