import type { DailyAttendancePolicy, StreakPolicySet } from '@entities/attendance';

import { formatKst } from '@shared/utils/date';

/** 현재·예약 카드 안에 반복해서 넣는 일일 정책 요약 — 적용 종료는 있을 때만 보인다 */
export function DailyPolicySummary({ policy }: { policy: DailyAttendancePolicy }) {
    return (
        <div className="min-w-0 break-words">
            <p>브론즈 {policy.rewardTicketCount}장</p>
            <p>적용 시작 {formatKst(policy.effectiveFrom)} KST</p>
            {policy.effectiveUntil && <p>적용 종료 {formatKst(policy.effectiveUntil)} KST</p>}
            <p>작성 {policy.createdByName ?? policy.createdBy}</p>
        </div>
    );
}

/** 현재·예약 카드 안에 반복해서 넣는 연속 정책 요약 — 단계별 마일스톤 목록 */
export function StreakPolicySummary({ policy }: { policy: StreakPolicySet }) {
    return (
        <div className="min-w-0 break-words">
            <p>적용 기준월 {policy.effectiveMonth} (KST)</p>
            <ul>
                {policy.milestones.map((m) => (
                    <li key={m.id}>
                        {m.milestoneDays}일 연속: 브론즈 {m.rewardTicketCount}장
                    </li>
                ))}
            </ul>
            <p>작성 {policy.createdByName ?? policy.createdBy}</p>
        </div>
    );
}
