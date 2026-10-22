import { MotionConfig, motion } from 'framer-motion';
import { ChevronRight, ChevronUp } from 'lucide-react';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { toast } from 'sonner';

import { useAttendanceMonth, useAttendanceToday } from '@entities/attendance';
import { getErrorMessage } from '@shared/api/errorMessage';
import { useVirtualClock } from '@shared/model/virtualClock';
import { Button } from '@shared/ui/button';
import { LoadError } from '@shared/ui/load-error';
import { SkeletonList } from '@shared/ui/skeleton';
import { cn } from '@shared/utils/cn';

import { useCheckAttendance } from '../api/queries';
import {
    buildAttendanceMonth,
    buildAttendanceWeek,
    claimedStreakBonuses,
    countMonthlyAttendance,
    toAttendanceDate,
} from '../utils/attendanceWeek';
import { nextStreakMilestone } from '../utils/nextStreakMilestone';
import { AttendanceBakingStage, BAKING_SPRITE_SRC } from './AttendanceBakingStage';
import { AttendanceMonthGrid } from './AttendanceMonthGrid';
import { AttendanceStreakTrack } from './AttendanceStreakTrack';
import { AttendanceWeekStrip } from './AttendanceWeekStrip';

const DAY_MS = 24 * 60 * 60 * 1000;

/** 굽기 스프라이트 재생 시간 — 응답이 빨라도 이만큼은 보여주고 끝나면 출석판을 펼친다 */
const BAKING_MIN_MS = 1600;

/** 접힌 카드 높이(px) — 안쪽 여백 24(DESIGN-SYSTEM 5절)에 맞춰 내용 높이를 예전(여백 16, 300px)만큼 남긴다 */
const COLLAPSED_HEIGHT = 316;

/**
 * 펼치거나 접은 직후 카드 안 요소가 짧게 떠오르며 나타난다 (order가 클수록 아주 조금 늦게).
 * 펼침·접힘 자체는 기다림 없이 바로 바뀌고, 이 효과는 바뀐 내용이 눈에 들어오게 하는 정도만 준다.
 * 페이지에 처음 들어올 때는 다른 페이지처럼 바로 보여준다 (enter가 false)
 */
function Rise({
    order,
    enter,
    className,
    children,
}: {
    order: number;
    enter: boolean;
    className?: string;
    children: ReactNode;
}) {
    return (
        <motion.div
            initial={enter ? { opacity: 0, y: 6 } : false}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.16, delay: order * 0.02, ease: [0.22, 1, 0.36, 1] }}
            className={className}
        >
            {children}
        </motion.div>
    );
}

// 접힌 카드와 펼친 카드가 같은 글자 크기를 쓴다
function AttendanceStat({ label, value }: { label: string; value: string }) {
    return (
        <div className="flex flex-col gap-2">
            <span className="text-fg-tertiary text-body-sm">{label}</span>
            <span className="text-fg-primary text-body-bold">{value}</span>
        </div>
    );
}

/**
 * 출석 카드. 접힌 상태는 최근 7일 스트립과 출석 버튼, 펼친 상태는 이번 달 달력을 보여준다.
 * 펼침 여부는 옆 카드의 너비도 바뀌므로 페이지가 관리한다.
 */
export function AttendanceCheckCard({
    expanded,
    onExpandedChange,
    className,
}: {
    expanded: boolean;
    onExpandedChange: (expanded: boolean) => void;
    className?: string;
}) {
    const statusQuery = useAttendanceToday();
    const { data: status, isPending } = statusQuery;
    const checkAttendance = useCheckAttendance();
    // 출석 판정은 서버가 하고, 여기서는 표시용 날짜 계산에만 쓴다
    const clock = useVirtualClock();
    const [now, setNow] = useState(() => clock.now());
    // 가상 시계 오버라이드가 바뀌면 렌더 단계에서 즉시 갱신한다 (effect setState는 lint 금지)
    const [lastClock, setLastClock] = useState(clock);
    if (lastClock !== clock) {
        setLastClock(clock);
        setNow(clock.now());
    }
    const today = status?.attendanceDate ?? toAttendanceDate(now);
    const displayDate = status ? new Date(`${status.attendanceDate}T12:00:00+09:00`) : now;
    const month = today.slice(0, 7);
    // 최근 7일이 지난달에 걸치면 그 달 출석일도 같이 받는다 — 주간 스트립이 월 경계를 넘을 수 있다
    const weekStartMonth = toAttendanceDate(new Date(displayDate.getTime() - 6 * DAY_MS)).slice(
        0,
        7,
    );
    const { data: monthData } = useAttendanceMonth(month);
    const { data: prevMonthData } = useAttendanceMonth(weekStartMonth, {
        enabled: weekStartMonth !== month,
    });
    const checkedDates = [
        ...(prevMonthData?.attendanceDates ?? []),
        ...(monthData?.attendanceDates ?? []),
    ];
    // 연속 출석 보상을 받은 날 — 이번 달(AT01)과, 최근 7일이 지난달에 걸치면 지난달(AT03) 단계 묶음의 받은 시각에서 구한다
    const bonusClaims = claimedStreakBonuses([
        ...(prevMonthData?.milestones ?? []),
        ...(status?.milestones ?? []),
    ]);
    const bonusDates: ReadonlySet<string> = new Set(bonusClaims.keys());

    // 화면을 열어 둔 채 출석 기준일(00:00 KST)이 지나도 오늘 표시가 따라오도록 주기적으로 확인한다.
    // 기준일이 바뀌지 않았으면 이전 Date를 돌려줘 리렌더를 일으키지 않는다
    useEffect(() => {
        const timer = setInterval(
            () =>
                setNow((prev) => {
                    const next = clock.now();
                    return toAttendanceDate(next) === toAttendanceDate(prev) ? prev : next;
                }),
            30_000,
        );
        return () => clearInterval(timer);
    }, [clock]);
    const [baking, setBaking] = useState(false);
    // 접힌 카드에서 출석했을 때 굽기 장면이 카드 전체를 채운다
    const [stageFull, setStageFull] = useState(false);
    // 펼치기·접기를 한 번이라도 했는지 — 그 뒤에만 내용이 떠오른다 (처음 들어올 때는 애니메이션 없음)
    const [contentEnter, setContentEnter] = useState(false);
    const showExpanded = expanded;
    const [revealDate, setRevealDate] = useState<string | null>(null);
    const handleRevealEnd = useCallback(() => setRevealDate(null), []);

    // 출석하기를 누른 순간 스프라이트가 늦게 떠서 깜빡이지 않도록 미리 불러 둔다
    useEffect(() => {
        const image = new Image();
        image.src = BAKING_SPRITE_SRC;
    }, []);

    // 펼치기·접기 — 기다림 없이 카드 폭·높이와 내용을 한 번에 바꾼다.
    // beforeExpand는 펼치면서 같이 바꿀 상태(굽기 장면 끄기 등)를 넣는다
    const expand = (beforeExpand?: () => void) => {
        setContentEnter(true);
        beforeExpand?.();
        onExpandedChange(true);
    };
    const collapse = () => {
        setContentEnter(true);
        onExpandedChange(false);
    };

    // 굽기 스프라이트 → (접혀 있었다면) 출석판을 펼침 → 오늘 칸에 타코야끼가 올라오는 순서
    const handleCheck = async () => {
        const fromCollapsed = !expanded;
        const endBaking = () => {
            setBaking(false);
            setStageFull(false);
        };
        setBaking(true);
        setStageFull(fromCollapsed);
        try {
            const receipt = await checkAttendance.mutateAsync({
                minDurationMs: BAKING_MIN_MS,
            });
            const granted = receipt.rewards.reduce((sum, reward) => sum + reward.ticketCount, 0);
            setRevealDate(receipt.attendanceDate);
            toast.success(`출석 확인! 해당 출석의 확정 보상은 브론즈 ${granted}장이에요.`);
            // 굽기 장면이 끝나면 바로 출석판으로 바꿔 펼친다
            if (fromCollapsed) expand(endBaking);
        } catch (error) {
            toast.error(
                getErrorMessage(error, '출석 처리에 실패했어요. 잠시 후 다시 시도해 주세요.'),
            );
        } finally {
            endBaking();
        }
    };

    // 굽는 동안에는 결과를 미리 보여주지 않도록 오늘을 출석 전으로 둔다
    const shownDates = baking ? checkedDates.filter((date) => date !== today) : checkedDates;
    const shownCheckedToday = !!status?.attended && !baking;

    const checkButton = status?.attended ? (
        <Button disabled size="lg" className="w-full">
            오늘 출석 완료
        </Button>
    ) : (
        // 오늘 할 일의 주된 행동이라 응모 버튼과 같은 악센트(노랑)
        <Button
            variant="accent"
            size="lg"
            className="w-full"
            disabled={checkAttendance.isPending || baking}
            onClick={() => void handleCheck()}
        >
            출석하고 응모권 {status?.dailyRewardTicketCount ?? 1}장 받기
        </Button>
    );

    // 다음 연속 출석 보상 — 아직 받지 않았고 이번 달 안에 닿을 수 있는 가장 가까운 단계
    const dayOfMonth = Number(today.slice(8, 10));
    // Date.UTC의 달은 0부터라 '다음 달 0일' = 이번 달 마지막 날
    const lastDay = new Date(
        Date.UTC(Number(today.slice(0, 4)), Number(today.slice(5, 7)), 0),
    ).getUTCDate();
    const nextMilestone =
        status &&
        nextStreakMilestone(
            status.milestones,
            status.consecutiveDays,
            lastDay - dayOfMonth + (status.attended ? 0 : 1),
        );

    const stats = status && (
        <AttendanceStatPair
            streak={status.consecutiveDays}
            monthly={countMonthlyAttendance(checkedDates, status.attended, displayDate)}
            // 다음 연속 출석 보너스 — 매일 출석 1장과 별도로 주는 단계 보상이라 '보너스'로 적는다 (getddo-spec attendance.md).
            // 두 칸 아래 한 줄로 둔다 — 연속 일수 칸 안에 넣으면 왼쪽 칸만 길어져 가운데 선과 간격이 어긋나 보였다 (접힌 카드에서만)
            streakHint={
                nextMilestone && !showExpanded
                    ? `연속 ${nextMilestone.milestoneDays}일 달성 시 보너스 ${nextMilestone.rewardTicketCount}장`
                    : undefined
            }
            compact={showExpanded}
        />
    );

    return (
        // 운영체제의 동작 줄이기 설정을 켠 사용자에게는 요소 등장 효과를 끈다
        <MotionConfig reducedMotion="user">
            <div
                // 접힌 카드는 옆 응모권 내역 카드와 높이를 맞추고, 펼친 카드는 출석판만큼 자란다
                style={{ height: showExpanded && !stageFull ? 'auto' : COLLAPSED_HEIGHT }}
                className={cn(
                    'bg-surface-page border-border-default relative flex flex-col rounded-2xl border p-6 shadow-md',
                    className,
                )}
            >
                {stageFull ? (
                    // 접힌 카드에서 출석하기 — 굽는 동안 굽기 장면이 카드 전체를 채운다
                    <AttendanceBakingStage
                        durationMs={BAKING_MIN_MS}
                        rewardTicketCount={status?.dailyRewardTicketCount}
                        className="flex-1"
                    />
                ) : (
                    // 펼친 내용과 접힌 내용은 key로 갈아 끼워 바뀐 쪽만 떠오르게 한다
                    <div
                        key={showExpanded ? 'expanded' : 'collapsed'}
                        className={cn(
                            'flex flex-1 flex-col',
                            showExpanded ? 'gap-4' : 'justify-between',
                        )}
                    >
                        {/* 접힌 카드의 펼치기 버튼은 최근 7일 스트립 머리에 둔다 */}
                        {showExpanded && (
                            <Rise order={0} enter={contentEnter} className="flex flex-col gap-4">
                                {/* 첫 줄: 연속 출석일수·이번 달 출석일수 2열과 접기. 둘째 줄: 보너스 진행 막대 (달력과 같은 폭) */}
                                <div className="flex items-start justify-between gap-4">
                                    {stats ?? <div />}
                                    <button
                                        type="button"
                                        aria-expanded="true"
                                        onClick={collapse}
                                        className="text-body-sm text-fg-secondary hover:text-fg-primary focus-visible:ring-border-focus focus-visible:ring-offset-surface-page flex shrink-0 cursor-pointer items-center rounded-sm transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
                                    >
                                        접기
                                        <ChevronUp className="size-5" />
                                    </button>
                                </div>
                                {status && (
                                    <AttendanceStreakTrack
                                        streak={status.consecutiveDays}
                                        milestones={status.milestones}
                                        next={nextMilestone ?? null}
                                    />
                                )}
                            </Rise>
                        )}

                        {/* 다시 받기 실패는 카드 안에 문장을 두지 않는다 — 카드가 밀려 무너졌다. 받아 둔 값을 그대로 두고 제목 옆 갱신 표시가 알린다 */}
                        {isPending && <SkeletonList count={2} rowClassName="h-16" />}
                        {/* 받아 둔 출석 정보가 없을 때만 — 카드 높이 안 가운데에 다시 시도를 둔다 */}
                        {!isPending && !status && (
                            <LoadError
                                title="출석 정보를 불러오지 못했어요"
                                onRetry={() => void statusQuery.refetch()}
                                retrying={statusQuery.isFetching}
                                className="flex-1"
                            />
                        )}

                        {status &&
                            (showExpanded ? (
                                baking ? (
                                    // 펼친 출석판에서 출석하기 — 출석판 자리만 굽기 장면으로 바뀐다
                                    <AttendanceBakingStage
                                        durationMs={BAKING_MIN_MS}
                                        rewardTicketCount={status.dailyRewardTicketCount}
                                        // 펼친 판 자리는 넓어서 글자를 틀 위쪽에서 조금 더 띄운다
                                        className="min-h-80 pt-10"
                                    />
                                ) : (
                                    <>
                                        <Rise order={1} enter={contentEnter}>
                                            <AttendanceMonthGrid
                                                days={buildAttendanceMonth(
                                                    shownDates,
                                                    shownCheckedToday,
                                                    displayDate,
                                                )}
                                                bonusClaims={bonusClaims}
                                                revealDate={revealDate}
                                                onRevealEnd={handleRevealEnd}
                                                onCheckToday={
                                                    status.attended
                                                        ? undefined
                                                        : () => void handleCheck()
                                                }
                                            />
                                        </Rise>
                                        {/* 접힌 카드와 같은 버튼을 출석판 아래에 둔다 — 오늘 판을 눌러도 출석된다 */}
                                        <Rise order={2} enter={contentEnter}>
                                            {checkButton}
                                        </Rise>
                                    </>
                                )
                            ) : (
                                <>
                                    {/* 위 여백은 카드 여백(24)만 — 아래(출석 버튼 밑 24)와 같게 둔다 */}
                                    <Rise order={1} enter={contentEnter} className="px-1">
                                        {stats}
                                    </Rise>
                                    {/* 최근 7일과 출석하기는 한 묶음으로 아래에 붙인다 — 남는 높이는 출석일수와 이 묶음 사이로 간다 */}
                                    <div className="flex flex-col gap-4">
                                        {/* 머리 오른쪽 '펼쳐보기'로 이번 달 출석판을 펼친다 */}
                                        <Rise
                                            order={2}
                                            enter={contentEnter}
                                            className="flex flex-col gap-2"
                                        >
                                            <div className="flex items-center justify-between px-1">
                                                <span className="text-body-sm-bold text-fg-secondary">
                                                    최근 7일
                                                </span>
                                                <button
                                                    type="button"
                                                    aria-expanded="false"
                                                    onClick={() => expand()}
                                                    className="text-body-sm text-fg-secondary hover:text-fg-primary focus-visible:ring-border-focus focus-visible:ring-offset-surface-page flex cursor-pointer items-center rounded-sm transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
                                                >
                                                    펼쳐보기
                                                    <ChevronRight className="size-5" />
                                                </button>
                                            </div>
                                            <AttendanceWeekStrip
                                                week={buildAttendanceWeek(
                                                    shownDates,
                                                    shownCheckedToday,
                                                    displayDate,
                                                )}
                                                bonusDates={bonusDates}
                                            />
                                        </Rise>
                                        <Rise order={3} enter={contentEnter}>
                                            {checkButton}
                                        </Rise>
                                    </div>
                                </>
                            ))}
                    </div>
                )}
            </div>
        </MotionConfig>
    );
}

function AttendanceStatPair({
    streak,
    monthly,
    streakHint,
    compact,
}: {
    streak: number;
    monthly: number;
    streakHint?: string;
    compact: boolean;
}) {
    return (
        <div className={cn('flex flex-col gap-3', compact ? 'w-fit' : 'w-full')}>
            <div className={cn('grid grid-cols-2', compact && 'gap-x-6')}>
                <AttendanceStat label="연속 출석일수" value={`연속 ${streak}일`} />
                <div className="border-border-strong border-l pl-4">
                    <AttendanceStat label="이번 달 출석일수" value={`${monthly}일`} />
                </div>
            </div>
            {streakHint && <p className="text-caption text-fg-tertiary">{streakHint}</p>}
        </div>
    );
}
