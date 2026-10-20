import { cn } from '@shared/utils/cn';

import type { AttendanceDay } from '../utils/attendanceWeek';

import { getAttendanceMascot } from '../model/mascots';

/**
 * 최근 7일 출석 스트립 — 출석판과 같은 규칙으로 보여준다.
 * 출석한 날은 원본, 출석하지 않은 날은 회색
 */
export function AttendanceWeekStrip({
    week,
    bonusDates,
}: {
    week: AttendanceDay[];
    /** 연속 출석 보상을 받은 출석 기준일 */
    bonusDates: ReadonlySet<string>;
}) {
    return (
        <ol className="bg-surface-sunken flex w-full items-center justify-between rounded-lg px-4 py-3">
            {week.map((day) => {
                const mascot = getAttendanceMascot(day.date, bonusDates);
                return (
                    <li
                        key={day.date}
                        className="flex w-7 flex-col items-center gap-1"
                        aria-label={`${day.label} ${day.checked ? '출석' : '미출석'}`}
                    >
                        <span className="size-6">
                            <img
                                src={mascot.src}
                                alt=""
                                className={cn(
                                    'size-full object-contain',
                                    !day.checked && 'opacity-50 grayscale',
                                )}
                            />
                        </span>
                        {/* 오늘은 펼친 출석판의 '오늘' 태그와 같은 응모권 노랑 알약 — 마젠타는 브랜드 강조에만 남긴다 */}
                        <span
                            className={
                                day.isToday
                                    ? 'text-caption bg-ticket-primary text-ticket-on rounded-full px-1.5 whitespace-nowrap'
                                    : 'text-caption text-fg-tertiary'
                            }
                        >
                            {day.label}
                        </span>
                    </li>
                );
            })}
        </ol>
    );
}
