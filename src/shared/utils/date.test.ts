import {
    formatKstDot,
    kstDateStartUtcIso,
    kstInputToUtcIso,
    kstNextDateStartUtcIso,
    kstNextMonthStart,
    parseYmd,
    utcIsoToKstInput,
    formatKstTimeRange,
    formatRemaining,
    recentKstDays,
} from './date';

describe('kstNextMonthStart', () => {
    it('다음 달 1일 00:00 KST를 반환한다', () => {
        // 2026-09-28 12:00 KST = 2026-09-28T03:00:00Z
        const next = kstNextMonthStart(new Date('2026-09-28T03:00:00Z'));
        expect(next.toISOString()).toBe('2026-09-30T15:00:00.000Z');
    });

    it('12월에는 다음 해 1월 1일로 넘어간다', () => {
        const next = kstNextMonthStart(new Date('2026-12-15T00:00:00Z'));
        expect(next.toISOString()).toBe('2026-12-31T15:00:00.000Z');
    });

    it('월 경계를 넘은 UTC 시각은 KST 기준 다음 달로 판정한다', () => {
        // UTC 9월 30일 16:00 = KST 10월 1일 01:00 — 이미 10월이므로 만료일은 11월 1일
        const next = kstNextMonthStart(new Date('2026-09-30T16:00:00Z'));
        expect(next.toISOString()).toBe('2026-10-31T15:00:00.000Z');
    });
});

describe('kstInputToUtcIso / utcIsoToKstInput', () => {
    it('datetime-local 입력을 KST로 해석해 UTC ISO로 변환한다', () => {
        expect(kstInputToUtcIso('2026-10-07T15:00')).toBe('2026-10-07T06:00:00.000Z');
    });

    it('UTC ISO를 datetime-local 입력값(KST)으로 되돌린다', () => {
        expect(utcIsoToKstInput('2026-10-07T06:00:00.000Z')).toBe('2026-10-07T15:00');
    });

    it('KST 자정 경계를 넘나들어도 날짜가 맞다', () => {
        expect(kstInputToUtcIso('2026-10-07T00:30')).toBe('2026-10-06T15:30:00.000Z');
        expect(utcIsoToKstInput('2026-10-06T15:30:00.000Z')).toBe('2026-10-07T00:30');
    });
});

describe('kstDateStartUtcIso / kstNextDateStartUtcIso', () => {
    it('날짜 입력을 KST 00:00의 UTC 시각으로 바꾼다', () => {
        expect(kstDateStartUtcIso('2026-10-12')).toBe('2026-10-11T15:00:00.000Z');
    });

    it('종료일은 다음 날 00:00 KST로 바꿔 종료일 전체를 포함한다', () => {
        expect(kstNextDateStartUtcIso('2026-10-12')).toBe('2026-10-12T15:00:00.000Z');
    });

    it('월말·연말 경계를 넘긴다', () => {
        expect(kstNextDateStartUtcIso('2026-10-31')).toBe('2026-10-31T15:00:00.000Z');
        expect(kstNextDateStartUtcIso('2026-12-31')).toBe('2026-12-31T15:00:00.000Z');
    });
});

describe('formatKstDot', () => {
    it('UTC 시각을 KST 날짜(와 시각)로 짧게 적는다', () => {
        // UTC 9월 17일 15:30 = KST 9월 18일 00:30
        expect(formatKstDot('2026-09-17T15:30:00Z')).toBe('09.18');
        expect(formatKstDot('2026-09-17T15:30:00Z', true)).toBe('09.18 00:30');
    });
});

describe('formatRemaining', () => {
    const MIN = 60 * 1000;
    const HOUR = 60 * MIN;
    it('하루가 넘으면 일·시간만 적는다', () => {
        expect(formatRemaining(7 * 24 * HOUR + 2 * HOUR + 5 * MIN)).toBe('7일 2시간');
        expect(formatRemaining(3 * 24 * HOUR)).toBe('3일');
    });
    it('한 시간이 넘으면 시간·분, 그 안쪽은 분·초', () => {
        expect(formatRemaining(HOUR + 23 * MIN + 10_000)).toBe('1시간 23분');
        expect(formatRemaining(9 * MIN + 50_000)).toBe('9분 50초');
        expect(formatRemaining(42_000)).toBe('42초');
    });
    it('분 단위로 그리는 곳은 초를 올려 분만 적는다', () => {
        expect(formatRemaining(9 * MIN + 50_000, 'minute')).toBe('10분');
        expect(formatRemaining(20_000, 'minute')).toBe('1분');
        expect(formatRemaining(60_001, 'minute')).toBe('2분');
        expect(formatRemaining(0, 'minute')).toBe('0분');
        expect(formatRemaining(-5_000, 'minute')).toBe('0분');
    });
});

describe('formatKstTimeRange', () => {
    it('같은 날이면 시작~마감 시각', () => {
        expect(formatKstTimeRange('2026-10-14T05:00:00Z', '2026-10-14T06:00:00Z')).toBe(
            '14:00 ~ 15:00',
        );
    });
    it('날을 넘기면 마감 날짜·시각', () => {
        expect(formatKstTimeRange('2026-10-14T05:42:00Z', '2026-11-03T05:42:00Z')).toBe(
            '11월 3일 14:42 마감',
        );
    });
});

describe('recentKstDays', () => {
    it('KST 오늘까지 오래된 날부터 하루 구간을 만든다', () => {
        // 10/16 00:30 KST — UTC로는 아직 10/15라도 KST 날짜 기준으로 자른다
        const days = recentKstDays(new Date('2026-10-15T15:30:00Z'), 3);
        expect(days.map((d) => d.ymd)).toEqual(['2026-10-14', '2026-10-15', '2026-10-16']);
        expect(days[2]).toEqual({
            ymd: '2026-10-16',
            from: '2026-10-15T15:00:00.000Z',
            to: '2026-10-16T15:00:00.000Z',
        });
    });
    it('달이 바뀌어도 이어진다', () => {
        const days = recentKstDays(new Date('2026-11-01T03:00:00Z'), 2);
        expect(days.map((d) => d.ymd)).toEqual(['2026-10-31', '2026-11-01']);
    });
});

describe('parseYmd', () => {
    it('달력에 있는 날짜는 그대로 돌려준다', () => {
        expect(parseYmd('2026-10-16')).toBe('2026-10-16');
        expect(parseYmd('2028-02-29')).toBe('2028-02-29');
    });

    it('꼴이 다르거나 비어 있으면 null', () => {
        expect(parseYmd(null)).toBeNull();
        expect(parseYmd('')).toBeNull();
        expect(parseYmd('2026-1-6')).toBeNull();
        expect(parseYmd('2026-10-16T00:00')).toBeNull();
    });

    it('꼴만 맞고 달력에 없는 날짜는 null — 다음 달로 넘어가거나 변환 오류가 나지 않게', () => {
        expect(parseYmd('2026-02-31')).toBeNull();
        expect(parseYmd('2026-02-29')).toBeNull();
        expect(parseYmd('2026-13-01')).toBeNull();
        expect(parseYmd('2026-00-10')).toBeNull();
    });
});
