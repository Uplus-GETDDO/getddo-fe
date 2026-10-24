import type { DailyAttendancePolicy, StreakPolicySet } from '@entities/attendance';

import { TICKET_GRADE_IMAGE } from '@entities/ticket';
import { DetailItem, DetailList } from '@shared/ui/detail-list';
import { formatKstFullDot } from '@shared/utils/date';

/** 보상은 늘 브론즈라 응모권 그림과 장수를 크게 — 숫자가 이 카드의 핵심이다 */
function BronzeReward({ count }: { count: number }) {
    return (
        <p className="text-fg-primary flex items-center gap-2 text-xl leading-7 font-semibold">
            <img src={TICKET_GRADE_IMAGE.BRONZE} alt="" aria-hidden className="h-6 w-auto" />
            브론즈 {count}장
        </p>
    );
}

/** 현재·예약 카드 안에 넣는 일일 정책 요약 — 적용 종료는 있을 때만 보인다 */
export function DailyPolicySummary({ policy }: { policy: DailyAttendancePolicy }) {
    return (
        <div className="flex min-w-0 flex-col gap-4">
            <div className="flex flex-col gap-1">
                <span className="text-caption text-fg-tertiary">하루 첫 출석 보상</span>
                <BronzeReward count={policy.rewardTicketCount} />
            </div>
            <DetailList>
                <DetailItem label="적용 시작">
                    <span className="tabular-nums">
                        {formatKstFullDot(policy.effectiveFrom, true)}
                    </span>
                </DetailItem>
                {policy.effectiveUntil && (
                    <DetailItem label="적용 종료">
                        <span className="tabular-nums">
                            {formatKstFullDot(policy.effectiveUntil, true)}
                        </span>
                    </DetailItem>
                )}
                <DetailItem label="작성자">{policy.createdByName ?? policy.createdBy}</DetailItem>
            </DetailList>
        </div>
    );
}

/** 현재·예약 카드 안에 넣는 연속 정책 요약 — 단계를 '며칠 → 몇 장' 칸으로 나란히 */
export function StreakPolicySummary({ policy }: { policy: StreakPolicySet }) {
    return (
        <div className="flex min-w-0 flex-col gap-4">
            <ol
                aria-label="연속 출석 단계"
                className="grid grid-cols-[repeat(auto-fill,minmax(6.5rem,1fr))] gap-2"
            >
                {policy.milestones.map((m) => (
                    <li
                        key={m.id}
                        aria-label={`${m.milestoneDays}일 연속: 브론즈 ${m.rewardTicketCount}장`}
                        className="bg-surface-canvas flex flex-col gap-0.5 rounded-lg px-3 py-2.5"
                    >
                        <span className="text-caption text-fg-tertiary tabular-nums">
                            {m.milestoneDays}일 연속
                        </span>
                        <span className="text-body-bold text-fg-primary tabular-nums">
                            {m.rewardTicketCount}장
                        </span>
                    </li>
                ))}
            </ol>
            <DetailList>
                <DetailItem label="적용 월">
                    <span className="tabular-nums">{policy.effectiveMonth.replace('-', '.')}</span>
                </DetailItem>
                <DetailItem label="보상 등급">브론즈</DetailItem>
                <DetailItem label="작성자">{policy.createdByName ?? policy.createdBy}</DetailItem>
            </DetailList>
        </div>
    );
}
