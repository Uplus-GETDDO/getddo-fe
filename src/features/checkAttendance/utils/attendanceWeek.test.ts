import {
    buildAttendanceMonth,
    buildAttendanceWeek,
    countMonthlyAttendance,
    claimedStreakBonuses,
    isStreakBonusDate,
    pickBonusMascotIndex,
} from './attendanceWeek';

// 출석 기준일은 00:00 KST에 바뀐다 = UTC로 전날 15:00
// 2026-09-26 23:59:59 KST = 2026-09-26 14:59:59 UTC → 출석 기준일은 아직 9/26
const beforeReset = new Date('2026-09-26T14:59:59Z');
// 2026-09-27 00:00 KST = 2026-09-26 15:00 UTC → 출석 기준일 9/27
const afterReset = new Date('2026-09-26T15:00:00Z');

describe('buildAttendanceWeek', () => {
    it('오늘을 마지막 칸으로 7일을 만들고 오늘 칸에 "오늘" 라벨을 붙인다', () => {
        const week = buildAttendanceWeek([], false, afterReset);
        expect(week).toHaveLength(7);
        expect(week[6]).toMatchObject({ date: '2026-09-27', label: '오늘', isToday: true });
        expect(week[0]).toMatchObject({ date: '2026-09-21', label: '월' });
    });

    it('00:00 KST 이전에는 전날(UTC)을 오늘로 본다', () => {
        const week = buildAttendanceWeek([], false, beforeReset);
        expect(week[6]?.date).toBe('2026-09-26');
    });

    it('checkedDates와 attended로 출석 여부를 표시한다', () => {
        const week = buildAttendanceWeek(['2026-09-25'], true, afterReset);
        expect(week.filter((day) => day.checked).map((day) => day.date)).toEqual([
            '2026-09-25',
            '2026-09-27',
        ]);
    });
});

describe('countMonthlyAttendance', () => {
    it('이번 달 출석일만 중복 없이 센다', () => {
        const dates = ['2026-08-31', '2026-09-01', '2026-09-27'];
        expect(countMonthlyAttendance(dates, true, afterReset)).toBe(2);
        expect(countMonthlyAttendance(dates, false, beforeReset)).toBe(2);
    });
});

describe('buildAttendanceMonth', () => {
    it('이번 달 1일부터 말일까지 만들고 출석일과 오늘을 표시한다', () => {
        const month = buildAttendanceMonth(['2026-09-01', '2026-08-31'], true, afterReset);
        expect(month).toHaveLength(30);
        expect(month[0]).toMatchObject({ date: '2026-09-01', day: 1, checked: true });
        expect(month[26]).toMatchObject({ day: 27, isToday: true, checked: true, isFuture: false });
        expect(month[25]).toMatchObject({ day: 26, isFuture: false });
        expect(month[27]).toMatchObject({ day: 28, isFuture: true });
        expect(month.filter((day) => day.checked)).toHaveLength(2);
    });

    it('31일까지 있는 달은 31칸을 만든다', () => {
        expect(buildAttendanceMonth([], false, new Date('2026-10-05T03:00:00Z'))).toHaveLength(31);
    });
});

describe('claimedStreakBonuses', () => {
    it('받은 단계만 받은 출석 기준일로 모은다 — 단계 일수와 날짜는 다를 수 있다', () => {
        const bonuses = claimedStreakBonuses([
            {
                milestoneDays: 7,
                rewardTicketCount: 1,
                claimed: true,
                claimedAt: '2026-09-11T01:00:00Z',
            },
            { milestoneDays: 14, rewardTicketCount: 3, claimed: false, claimedAt: null },
        ]);
        expect([...bonuses]).toEqual([['2026-09-11', 1]]);
    });
});

describe('isStreakBonusDate', () => {
    it('보상을 받은 날짜만 보상일이다', () => {
        const bonusDates = new Set(['2026-09-11']);
        expect(isStreakBonusDate('2026-09-11', bonusDates)).toBe(true);
        expect(isStreakBonusDate('2026-09-07', bonusDates)).toBe(false);
    });
});

describe('pickBonusMascotIndex', () => {
    const bonusDates = new Set(['2026-09-07', '2026-09-14', '2026-09-28']);

    it('같은 날짜는 항상 같은 캐릭터를 고른다', () => {
        expect(pickBonusMascotIndex('2026-09-14', bonusDates, 4)).toBe(
            pickBonusMascotIndex('2026-09-14', bonusDates, 4),
        );
    });

    it('한 달 안의 보상일끼리는 캐릭터가 겹치지 않는다', () => {
        const picked = ['2026-09-07', '2026-09-14', '2026-09-28'].map((date) =>
            pickBonusMascotIndex(date, bonusDates, 4),
        );
        expect(new Set(picked).size).toBe(3);
    });
});
