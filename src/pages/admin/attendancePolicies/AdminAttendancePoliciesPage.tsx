import { useState } from 'react';

import type { DailyAttendancePolicy, StreakPolicySet } from '@entities/attendance';
import type { PolicyEditTarget } from '@features/manageAttendancePolicy';

import { useDailyAttendancePolicies, useStreakPolicies } from '@entities/attendance';
import { AttendancePolicyEditDialog, AttendancePolicyForm } from '@features/manageAttendancePolicy';
import { getErrorMessage } from '@shared/api/errorMessage';
import { getPollingRetryDelay } from '@shared/api/queryPresets';
import { useVirtualClock } from '@shared/model/virtualClock';
import { Button } from '@shared/ui/button';
import { PagedResult } from '@shared/ui/paged-result';
import { formatKst, formatYmd } from '@shared/utils/date';

export function AdminAttendancePoliciesPage() {
    const [dailyPage, setDailyPage] = useState(1);
    const [streakPage, setStreakPage] = useState(1);
    const [editing, setEditing] = useState<PolicyEditTarget | null>(null);
    const daily = useDailyAttendancePolicies(dailyPage);
    const streak = useStreakPolicies(streakPage);
    const now = useVirtualClock().now();
    // 표시용 사전 판정 — 최종 판단은 서버(409 ATTENDANCE-007)가 한다
    const kstMonth = formatYmd(now.toISOString()).slice(0, 7);
    const editableDaily = (p: DailyAttendancePolicy) => new Date(p.effectiveFrom) > now;
    const editableStreak = (p: StreakPolicySet) => p.effectiveMonth > kstMonth;
    return (
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 p-4 sm:p-6">
            <h1 className="text-title-2">출석 정책</h1>
            <p>
                기존 달성·지급 기록은 유지합니다. 같은 적용일·기준월의 중복 예약은 허용되지
                않습니다.
            </p>
            <section
                className="bg-surface-elevated flex min-w-0 flex-col gap-5 rounded-xl p-4"
                aria-labelledby="daily-title"
            >
                <h2 id="daily-title" className="text-title-3">
                    일일 출석
                </h2>
                <AttendancePolicyForm kind="daily" />
                <Button
                    className="min-h-11"
                    variant="secondary"
                    disabled={daily.isFetching}
                    onClick={() => {
                        if (!getPollingRetryDelay(daily.error)) void daily.refetch();
                    }}
                >
                    일일 정책 새로 조회
                </Button>
                <PagedResult
                    {...daily}
                    page={dailyPage}
                    onPageChange={setDailyPage}
                    emptyText="등록된 정책이 없습니다."
                    errorText={getErrorMessage(
                        daily.error,
                        '정책을 조회하지 못했습니다. 이전 성공값이 있으면 유지합니다.',
                    )}
                    onRetry={() => {
                        if (!getPollingRetryDelay(daily.error)) void daily.refetch();
                    }}
                >
                    {(items) => (
                        <ul className="flex flex-col gap-3">
                            {items.map((p) => (
                                <li
                                    key={p.id}
                                    className="border-border-default flex min-w-0 flex-wrap items-center justify-between gap-3 rounded-lg border p-3"
                                >
                                    <div className="min-w-0 break-words">
                                        <p>브론즈 {p.rewardTicketCount}장</p>
                                        <p>작성 {p.createdByName ?? p.createdBy}</p>
                                        <p>적용 시작 {formatKst(p.effectiveFrom)} KST</p>
                                        <p>
                                            적용 종료{' '}
                                            {p.effectiveUntil
                                                ? `${formatKst(p.effectiveUntil)} KST`
                                                : '미정'}
                                        </p>
                                    </div>
                                    {editableDaily(p) && (
                                        <Button
                                            variant="secondary"
                                            onClick={() => setEditing({ kind: 'daily', policy: p })}
                                        >
                                            수정
                                        </Button>
                                    )}
                                </li>
                            ))}
                        </ul>
                    )}
                </PagedResult>
            </section>
            <section
                className="bg-surface-elevated flex min-w-0 flex-col gap-5 rounded-xl p-4"
                aria-labelledby="streak-title"
            >
                <h2 id="streak-title" className="text-title-3">
                    월간 연속 출석
                </h2>
                <AttendancePolicyForm kind="streak" />
                <Button
                    className="min-h-11"
                    variant="secondary"
                    disabled={streak.isFetching}
                    onClick={() => {
                        if (!getPollingRetryDelay(streak.error)) void streak.refetch();
                    }}
                >
                    연속 정책 새로 조회
                </Button>
                <PagedResult
                    {...streak}
                    page={streakPage}
                    onPageChange={setStreakPage}
                    emptyText="등록된 정책이 없습니다."
                    errorText={getErrorMessage(
                        streak.error,
                        '정책을 조회하지 못했습니다. 이전 성공값이 있으면 유지합니다.',
                    )}
                    onRetry={() => {
                        if (!getPollingRetryDelay(streak.error)) void streak.refetch();
                    }}
                >
                    {(items) => (
                        <ul className="flex flex-col gap-3">
                            {items.map((p) => (
                                <li
                                    key={p.id}
                                    className="border-border-default flex min-w-0 flex-wrap items-center justify-between gap-3 rounded-lg border p-3"
                                >
                                    <div className="min-w-0 break-words">
                                        <p>적용 기준월 {p.effectiveMonth} (KST)</p>
                                        <p>작성 {p.createdByName ?? p.createdBy}</p>
                                        <ul>
                                            {p.milestones.map((m) => (
                                                <li key={m.id}>
                                                    {m.milestoneDays}일 연속: 브론즈{' '}
                                                    {m.rewardTicketCount}장
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                    {editableStreak(p) && (
                                        <Button
                                            variant="secondary"
                                            onClick={() =>
                                                setEditing({ kind: 'streak', policy: p })
                                            }
                                        >
                                            수정
                                        </Button>
                                    )}
                                </li>
                            ))}
                        </ul>
                    )}
                </PagedResult>
            </section>
            {editing && (
                <AttendancePolicyEditDialog target={editing} onClose={() => setEditing(null)} />
            )}
        </div>
    );
}
