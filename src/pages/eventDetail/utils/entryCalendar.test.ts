import { buildEntryCalendar, kstDateKey } from './entryCalendar';

describe('kstDateKey', () => {
    it('KST 자정 직후 응모는 그날로 센다', () => {
        // 2026-10-16 00:30 KST = 2026-10-15 15:30 UTC — 시각만 자르면 전날이 된다
        expect(kstDateKey('2026-10-15T15:30:00Z')).toBe('2026-10-16');
    });

    it('KST 자정 직전 응모는 전날로 센다', () => {
        expect(kstDateKey('2026-10-15T14:59:00Z')).toBe('2026-10-15');
    });
});

describe('buildEntryCalendar', () => {
    const now = new Date('2026-10-16T03:00:00Z'); // 2026-10-16 12:00 KST

    it('시작일과 종료일을 모두 포함한다', () => {
        const cal = buildEntryCalendar(
            '2026-10-11T15:00:00Z', // 10-12 KST
            '2026-10-14T14:59:00Z', // 10-14 KST
            [],
            now,
        );
        expect(cal.days.map((d) => d.key)).toEqual(['2026-10-12', '2026-10-13', '2026-10-14']);
    });

    it('첫 주의 빈 칸을 요일에 맞춘다', () => {
        // 2026-10-12는 월요일 — 일요일 시작 달력이라 앞에 한 칸 비운다
        const cal = buildEntryCalendar('2026-10-11T15:00:00Z', '2026-10-14T14:59:00Z', [], now);
        expect(cal.leadingBlanks).toBe(1);
    });

    it('응모한 날에 표시하고 같은 날 여러 건은 한 칸으로 합친다', () => {
        const cal = buildEntryCalendar(
            '2026-10-11T15:00:00Z',
            '2026-10-19T14:59:00Z',
            ['2026-10-12T01:00:00Z', '2026-10-12T09:00:00Z', '2026-10-14T05:00:00Z'],
            now,
        );
        expect(cal.enteredCount).toBe(2);
        expect(cal.days.find((d) => d.key === '2026-10-12')?.entered).toBe(true);
        expect(cal.days.find((d) => d.key === '2026-10-13')?.entered).toBe(false);
    });

    it('오늘과 지나간 미응모를 구분한다', () => {
        const cal = buildEntryCalendar('2026-10-11T15:00:00Z', '2026-10-19T14:59:00Z', [], now);
        const today = cal.days.find((d) => d.key === '2026-10-16');
        expect(today).toMatchObject({ today: true, missed: false });
        expect(cal.days.find((d) => d.key === '2026-10-15')?.missed).toBe(true);
        // 아직 오지 않은 날은 미응모로 적지 않는다
        expect(cal.days.find((d) => d.key === '2026-10-17')?.missed).toBe(false);
    });

    it('기간이 아주 길어도 칸 수를 제한한다', () => {
        const cal = buildEntryCalendar('2026-01-01T00:00:00Z', '2026-12-31T00:00:00Z', [], now);
        expect(cal.days.length).toBe(92);
    });
});
