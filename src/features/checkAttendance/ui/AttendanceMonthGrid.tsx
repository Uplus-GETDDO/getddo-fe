import { motion } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';

import { cn } from '@shared/utils/cn';

import type { AttendanceMonthDay } from '../utils/attendanceWeek';
import type { TodayRevealStage } from './AttendanceTodayReveal';

import { REVEAL_BAKE_MS, REVEAL_LAND_MS } from '../model/attendanceMotion';
import { BATTER_MASCOT, DIZZY_MASCOT, STEAM_IMAGE, getAttendanceMascot } from '../model/mascots';
import { AttendanceTodayReveal } from './AttendanceTodayReveal';

/** 이 시간 안에 이만큼 누르면 타코야끼가 어지러워한다 */
const DIZZY_CLICKS = 5;
const DIZZY_WINDOW_MS = 2500;
const DIZZY_DURATION_MS = 2200;
/** 어지러움에서 돌아오는 연출 시간 — 얼굴이 스르르 바뀌며 가볍게 털어낸다 */
const RECOVER_MS = 700;
/** 오늘 판 김 — 평소엔 숨기고, 올리면 아래에서 위로 피어올랐다 사라지기를 되풀이한다 */
const STEAM_VARIANTS = {
    rest: { opacity: 0, y: 4 },
    hover: {
        opacity: [0, 0.85, 0],
        y: [4, -8],
        transition: { duration: 1.6, repeat: Infinity, ease: 'easeOut' as const },
    },
};

/** 요일 머리 — 접힌 카드의 최근 7일과 같은 요일 이름. 한국 달력처럼 일요일부터 */
const WEEKDAY_LABELS = ['일', '월', '화', '수', '목', '금', '토'];

/**
 * 이번 달 출석판 — 일~토 7열 달력. 1일은 실제 요일 자리에서 시작한다 (접힌 카드의 최근 7일과 같은 요일 기준).
 * - 판 바탕 없이 날짜 원만 둔다. 색은 출석한 타코야끼와 오늘에만 모은다
 *   · 출석한 날: 기본 타코야끼
 *   · 출석하지 않은 날(지난날·오늘·앞으로 올 날): 빈 홈(옅은 회색 + 안쪽 그림자) + 날짜 — 타코야끼 판의 홈처럼
 *   · 숫자가 있는 칸 = 아직 채우지 못한 날, 숫자 없이 캐릭터만 있는 칸 = 출석한 날
 * - 연속 출석 보상을 실제로 받은 날만 보상 캐릭터·금색 테두리로 표시한다 (앞으로 받을 단계는 위 진행 막대가 보여 준다)
 * - 판 오른쪽 위에 작은 태그를 단다: '오늘', 보상 받은 날 '+N'(둘 다 응모권 노랑). 둘 다면 한 알약으로 이어 붙인다
 * - 출석한 타코야끼를 누르면 뒤집히고, 너무 많이 누르면 잠깐 어지러워했다가 스르르 돌아온다
 * - 아직 출석하지 않은 오늘 판은 누르면 출석한다 (onCheckToday)
 */
export function AttendanceMonthGrid({
    days,
    bonusClaims,
    revealDate,
    onRevealEnd,
    onCheckToday,
}: {
    days: AttendanceMonthDay[];
    /** 연속 출석 보상을 받은 출석 기준일 → 그날 받은 추가 응모권 수 */
    bonusClaims: ReadonlyMap<string, number>;
    /** 방금 출석한 날 — 반죽이 구워지다가 타코야끼가 휘리릭 찍히는 연출을 준다 */
    revealDate?: string | null;
    /** 오늘 칸 연출이 끝났을 때 — 다시 펼쳐도 연출이 반복되지 않도록 부모가 revealDate를 지운다 */
    onRevealEnd?: () => void;
    /** 아직 출석하지 않은 오늘 칸을 눌렀을 때 — 넘기면 오늘 판이 출석 버튼이 된다 */
    onCheckToday?: () => void;
}) {
    // 오늘 칸 연출 단계: 굽기 → 떨어져 찍힘 → 끝 (판 흔들림은 없앴다)
    const [revealStage, setRevealStage] = useState<TodayRevealStage | 'done'>(() =>
        revealDate ? 'baking' : 'done',
    );

    useEffect(() => {
        if (!revealDate) return;
        const landAt = REVEAL_BAKE_MS;
        const doneAt = REVEAL_BAKE_MS + REVEAL_LAND_MS;
        const timers = [
            setTimeout(() => setRevealStage('landing'), landAt),
            setTimeout(() => {
                setRevealStage('done');
                onRevealEnd?.();
            }, doneAt),
        ];
        return () => timers.forEach(clearTimeout);
    }, [revealDate, onRevealEnd]);

    const [flips, setFlips] = useState<Record<string, number>>({});
    const [dizzy, setDizzy] = useState<ReadonlySet<string>>(() => new Set());
    const [recovering, setRecovering] = useState<ReadonlySet<string>>(() => new Set());
    const clicks = useRef<Record<string, number[]>>({});
    // 어지러움→복귀 예약 타이머 — 언마운트 후 setState를 막기 위해 전부 추적한다
    const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

    useEffect(() => {
        const pending = timers.current;
        return () => pending.forEach((t) => clearTimeout(t));
    }, []);

    // 누른 시각은 클릭 이벤트의 발생 시각(timeStamp)을 쓴다
    const handlePress = (date: string, now: number) => {
        if (dizzy.has(date)) return;
        setFlips((prev) => ({ ...prev, [date]: (prev[date] ?? 0) + 1 }));
        const recent = [...(clicks.current[date] ?? []), now].filter(
            (time) => now - time < DIZZY_WINDOW_MS,
        );
        clicks.current[date] = recent;
        if (recent.length < DIZZY_CLICKS) return;
        clicks.current[date] = [];
        setDizzy((prev) => new Set(prev).add(date));
        const without = (prev: ReadonlySet<string>) => {
            const next = new Set(prev);
            next.delete(date);
            return next;
        };
        timers.current.push(
            setTimeout(() => {
                setDizzy(without);
                setRecovering((prev) => new Set(prev).add(date));
                timers.current.push(setTimeout(() => setRecovering(without), RECOVER_MS));
            }, DIZZY_DURATION_MS),
        );
    };

    const bonusDates: ReadonlySet<string> = new Set(bonusClaims.keys());
    // 1일 앞의 빈칸 수 = 1일의 요일 (일요일 0). 출석 기준일은 날짜 문자열이라 UTC 자정으로 읽어 요일만 뽑는다
    const firstDate = days[0]?.date;
    const leadingBlanks = firstDate ? new Date(`${firstDate}T00:00:00Z`).getUTCDay() : 0;

    return (
        <div className="flex flex-col gap-2">
            {/* 열 너비를 홈 크기(최대 56px)로 두고 양끝에 붙인다 — 첫 원은 왼쪽 끝, 마지막 원은 오른쪽 끝에 닿아 위 진행 막대와 끝이 맞는다 */}
            <div
                aria-hidden
                className="grid grid-cols-[repeat(7,minmax(0,3.5rem))] justify-between"
            >
                {WEEKDAY_LABELS.map((label) => (
                    <span key={label} className="text-caption text-fg-tertiary text-center">
                        {label}
                    </span>
                ))}
            </div>
            <ol className="grid w-full grid-cols-[repeat(7,minmax(0,3.5rem))] justify-between gap-y-3">
                {Array.from({ length: leadingBlanks }, (_, index) => (
                    <li key={`blank-${index}`} aria-hidden />
                ))}
                {days.map((day) => {
                    const bonusTickets = bonusClaims.get(day.date);
                    const isBonus = bonusTickets != null;
                    const isDizzy = dizzy.has(day.date);
                    const isRecovering = recovering.has(day.date);
                    const mascot = getAttendanceMascot(day.date, bonusDates);
                    return (
                        <li
                            key={day.date}
                            aria-label={`${day.day}일 ${day.checked ? '출석' : '미출석'}${isBonus ? `, 연속 출석 보너스 응모권 ${bonusTickets}장 받음` : ''}`}
                            aria-current={day.isToday ? 'date' : undefined}
                            className={cn(
                                // 타코야끼 판의 오목한 홈 — 옅은 회색에 위쪽 안쪽 그림자와 아래쪽 얇은 밝은 테를 넣어 깊게 파여 보이게 한다
                                'bg-surface-sunken relative flex aspect-square w-full max-w-14 items-center justify-center justify-self-center rounded-full shadow-[inset_0_3px_5px_0_rgb(from_var(--color-ink)_r_g_b_/_0.18),inset_0_-2px_0_0_var(--color-surface-page)]',
                                // 보상 받은 날 판은 금색 테두리로 다른 날과 구분한다 (노란 +N 태그와 짝)
                                isBonus && 'ring-grade-gold ring-2',
                            )}
                        >
                            {/*
                          판 오른쪽 위 태그 — 오늘과 보상 받은 날의 추가 응모권 수, 둘 다 응모권 노랑.
                          둘 다 있는 날은 겹치지 않게 한 알약 모양으로 이어 붙인다 (왼쪽 오늘, 오른쪽 +N)
                        */}
                            {(day.isToday || bonusTickets != null) && (
                                <span
                                    aria-hidden
                                    className="text-caption pointer-events-none absolute -top-2 -right-1 z-10 flex overflow-hidden rounded-full leading-4 whitespace-nowrap shadow-sm"
                                >
                                    {day.isToday && (
                                        <span className="bg-ticket-primary text-ticket-on px-1.5">
                                            오늘
                                        </span>
                                    )}
                                    {bonusTickets != null && (
                                        <span
                                            className={cn(
                                                'bg-ticket-primary text-ticket-on px-1.5',
                                                // 오늘과 이어 붙을 때는 얇은 선으로만 나눈다
                                                day.isToday && 'border-ticket-on/20 border-l',
                                            )}
                                        >
                                            +{bonusTickets}
                                        </span>
                                    )}
                                </span>
                            )}
                            {day.date === revealDate && revealStage !== 'done' ? (
                                <AttendanceTodayReveal
                                    stage={revealStage}
                                    day={day.day}
                                    mascotSrc={mascot.src}
                                />
                            ) : day.isToday && !day.checked && onCheckToday ? (
                                // 아직 출석하지 않은 오늘 판 — 눌러서 바로 출석한다. 노란 테두리로 알리고, 올리면 크기는 그대로 두고 반죽이 담긴다 (크기가 변하면 글자가 덜컥거려 보인다)
                                <motion.button
                                    type="button"
                                    aria-label="오늘 출석하기"
                                    onClick={onCheckToday}
                                    // 올리거나 초점이 가면 아래 김(steam)이 모락모락 피어오른다
                                    initial="rest"
                                    animate="rest"
                                    whileHover="hover"
                                    whileFocus="hover"
                                    className="ring-ticket-primary focus-visible:ring-border-focus text-body-bold text-fg-primary group relative flex size-full cursor-pointer items-center justify-center rounded-full ring-2 focus-visible:outline-none"
                                >
                                    {/* 올리면 홈에 반죽(image 86)이 담긴다 — 곧 구워질 자리라는 힌트 */}
                                    <img
                                        src={BATTER_MASCOT.src}
                                        alt=""
                                        // 그림은 inset만으로는 늘어나지 않아 위치와 크기(홈의 86%)를 함께 준다
                                        className="absolute top-[7%] left-[7%] size-[86%] object-contain opacity-0 transition-opacity duration-200 group-hover:opacity-100 group-focus-visible:opacity-100"
                                    />
                                    {/* 반죽이 담기면 날짜는 숨긴다 */}
                                    <span className="relative transition-opacity duration-200 group-hover:opacity-0 group-focus-visible:opacity-0">
                                        {day.day}
                                    </span>
                                    {/* 김(image 248) — 반죽 위로 조그맣게 피어올랐다 사라지기를 되풀이한다. 오른쪽 위 '오늘' 태그를 피해 가운데보다 조금 왼쪽 */}
                                    <motion.img
                                        src={STEAM_IMAGE}
                                        alt=""
                                        aria-hidden
                                        variants={STEAM_VARIANTS}
                                        className="pointer-events-none absolute -top-4 left-[38%] w-4 -translate-x-1/2"
                                    />
                                </motion.button>
                            ) : day.checked ? (
                                <button
                                    type="button"
                                    aria-label={`${day.day}일 타코야끼 뒤집기`}
                                    onClick={(event) => handlePress(day.date, event.timeStamp)}
                                    // 홈(최대 56px)의 86% = 48px — 홈 가장자리가 둘레로 보여 타코야끼가 판에 담긴 것처럼 보인다. 좁은 화면에서는 홈에 맞춰 함께 줄어든다
                                    className="focus-visible:ring-border-focus focus-visible:ring-offset-surface-page relative size-[86%] rounded-full [perspective:320px] focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none enabled:cursor-pointer"
                                >
                                    {/*
                                  원래 타코야끼와 어지러운 타코야끼를 겹쳐 두고 투명도로 바꾼다.
                                  어지러울 때는 휘청이고, 돌아올 때는 흔들림이 잦아들며 원래 얼굴로 스르르 바뀐다
                                */}
                                    <motion.span
                                        className="absolute inset-0"
                                        initial={false}
                                        animate={{
                                            rotateY: (flips[day.date] ?? 0) * 360,
                                            rotate: isDizzy
                                                ? [0, -14, 12, -10, 8, -6, 4, 0]
                                                : isRecovering
                                                  ? [0, 5, -3, 1.5, 0]
                                                  : 0,
                                            scale: isRecovering ? [1, 1.06, 0.98, 1] : 1,
                                        }}
                                        transition={{
                                            rotateY: { duration: 0.6, ease: 'easeOut' },
                                            rotate: {
                                                duration: isDizzy ? 1.6 : RECOVER_MS / 1000,
                                                ease: 'easeInOut',
                                            },
                                            scale: { duration: RECOVER_MS / 1000, ease: 'easeOut' },
                                        }}
                                    >
                                        <img
                                            src={mascot.src}
                                            alt=""
                                            className={cn(
                                                'absolute inset-0 size-full object-contain drop-shadow-[0_2px_2px_rgb(from_var(--color-ink)_r_g_b_/_0.18)] transition-opacity duration-700 ease-out',
                                                isDizzy && 'opacity-0',
                                            )}
                                        />
                                        <img
                                            src={DIZZY_MASCOT.src}
                                            alt=""
                                            aria-hidden
                                            className={cn(
                                                'absolute inset-0 size-full object-contain drop-shadow-[0_2px_2px_rgb(from_var(--color-ink)_r_g_b_/_0.18)] transition-opacity duration-500 ease-out',
                                                isDizzy ? 'opacity-100' : 'opacity-0',
                                            )}
                                        />
                                    </motion.span>
                                </button>
                            ) : (
                                // 출석하지 않은 날 — 빈 홈 위에 날짜
                                <span className="text-body-bold text-fg-secondary flex size-full items-center justify-center rounded-full">
                                    {day.day}
                                </span>
                            )}
                        </li>
                    );
                })}
            </ol>
        </div>
    );
}
