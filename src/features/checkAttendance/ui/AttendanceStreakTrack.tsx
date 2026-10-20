import { Check } from 'lucide-react';

import type { AttendanceMilestone } from '@entities/attendance';

import { cn } from '@shared/utils/cn';

import type { NextStreakMilestone } from '../utils/nextStreakMilestone';

/**
 * 펼친 출석 카드의 연속 출석 보너스 진행 막대 — 출석일수 2열 아래, 달력과 같은 폭으로 둔다.
 * - 막대 위에 다음 보너스까지 남은 날을 적고, 남은 날과 받을 장수는 굵게 강조한다
 * - 막대는 단계(초기 설정 7·14·28일)를 표시하고 연속 일수만큼 채운다. 마지막 단계 원의 오른쪽 끝이 아래 달력의 오른쪽 끝과 맞는다
 * - 단계 원은 받았으면 노란 바탕에 체크, 아직이면 막대와 같은 회색 바탕에 +N
 * - 연속이 끊기면 막대는 0으로 돌아가지만, 같은 달에 받은 단계는 다시 주지 않으니 체크는 남는다 (getddo-spec attendance.md)
 */
export function AttendanceStreakTrack({
    streak,
    milestones,
    next,
}: {
    streak: number;
    milestones: readonly AttendanceMilestone[];
    /** 이번 달 안에 닿을 수 있는 다음 단계 — 없으면 안내 문구를 바꾼다 */
    next: NextStreakMilestone | null;
}) {
    const steps = [...milestones].sort((a, b) => a.milestoneDays - b.milestoneDays);
    const last = steps.at(-1)?.milestoneDays;
    const percent = (days: number) => (last ? `${(Math.min(days, last) / last) * 100}%` : '0%');
    const allClaimed = steps.every((step) => step.claimed);

    return (
        last && (
            <div className="flex flex-col gap-2">
                <p className="text-body-sm text-fg-secondary">
                    {next ? (
                        <>
                            <strong className="text-fg-primary font-semibold">
                                {next.remainingDays}일
                            </strong>{' '}
                            더 연속 출석하면 보너스{' '}
                            <strong className="text-fg-primary font-semibold">
                                +{next.rewardTicketCount}장
                            </strong>
                        </>
                    ) : allClaimed ? (
                        '이번 달 연속 출석 보너스를 모두 받았어요'
                    ) : (
                        '연속 출석 보너스'
                    )}
                </p>
                {/* 막대는 달력 첫 열 왼쪽 끝에서 시작하고, 마지막 원이 잘리지 않게 오른쪽만 원 반지름만큼 안쪽에 둔다 */}
                <div className="mr-3 flex flex-col gap-0.5">
                    <div className="relative h-6">
                        <div
                            aria-hidden
                            className="bg-border-default absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 rounded-full"
                        />
                        <div
                            aria-hidden
                            className="bg-ticket-primary absolute top-1/2 left-0 h-1 -translate-y-1/2 rounded-full transition-[width] duration-500"
                            style={{ width: percent(streak) }}
                        />
                        <ol aria-label={`연속 ${streak}일`}>
                            {steps.map((step) => (
                                <li
                                    key={step.milestoneDays}
                                    aria-label={`연속 ${step.milestoneDays}일 보너스 +${step.rewardTicketCount}장${step.claimed ? ' 받음' : ''}`}
                                    className={cn(
                                        'absolute top-1/2 flex size-6 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full text-[0.625rem] leading-none font-semibold',
                                        step.claimed
                                            ? 'bg-ticket-primary text-ticket-on'
                                            : 'bg-border-default text-fg-secondary',
                                    )}
                                    style={{ left: percent(step.milestoneDays) }}
                                >
                                    {step.claimed ? (
                                        <Check aria-hidden className="size-3" strokeWidth={3} />
                                    ) : (
                                        <span aria-hidden>+{step.rewardTicketCount}</span>
                                    )}
                                </li>
                            ))}
                        </ol>
                    </div>
                    <div aria-hidden className="text-caption text-fg-tertiary relative h-4">
                        {steps.map((step) => (
                            <span
                                key={step.milestoneDays}
                                className="absolute -translate-x-1/2 whitespace-nowrap"
                                style={{ left: percent(step.milestoneDays) }}
                            >
                                {step.milestoneDays}일
                            </span>
                        ))}
                    </div>
                </div>
            </div>
        )
    );
}
