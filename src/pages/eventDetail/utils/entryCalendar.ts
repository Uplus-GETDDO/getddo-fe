import { toKst } from '@shared/utils/date';

/**
 * 이벤트 기간을 KST 날짜 칸으로 펼친다.
 *
 * 응모 기록은 UTC 시각으로 오고 사용자는 KST 달력으로 본다. 새벽 1시 응모는 UTC로 전날이라
 * 시각을 그대로 자르면 하루 어긋난다. 그래서 KST로 옮긴 뒤 날짜만 떼어 비교한다.
 */

/** UTC 시각을 KST 기준 YYYY-MM-DD로 — 달력 칸을 맞추는 열쇠다 */
export function kstDateKey(iso: string | Date): string {
    return toKst(iso).toISOString().slice(0, 10);
}

export interface CalendarDay {
    /** YYYY-MM-DD (KST) */
    key: string;
    /** 그 달의 몇 일 */
    day: number;
    /** 이 날 응모한 기록이 있다 */
    entered: boolean;
    /** 오늘이다 */
    today: boolean;
    /** 지났는데 응모하지 않았다 */
    missed: boolean;
}

export interface EntryCalendar {
    /** 첫 주에서 이벤트 시작 전까지 비워 둘 칸 수 (일요일 시작) */
    leadingBlanks: number;
    days: CalendarDay[];
    /** 응모한 날 수 */
    enteredCount: number;
}

/** 하루를 날짜 칸 하나로 — 긴 기간이 통째로 그려지지 않게 상한을 둔다 */
const MAX_DAYS = 92;

/**
 * 시작~종료(모두 포함)를 날짜 칸으로 만들고 응모한 날에 표시한다.
 * enteredAt은 응모 시각 목록이고, 같은 날이 여러 번 있어도 칸 하나로 합쳐진다.
 */
export function buildEntryCalendar(
    startsAt: string,
    endsAt: string,
    enteredAt: readonly string[],
    now: Date,
): EntryCalendar {
    const startKey = kstDateKey(startsAt);
    const endKey = kstDateKey(endsAt);
    const todayKey = kstDateKey(now);
    const entered = new Set(enteredAt.map(kstDateKey));

    const days: CalendarDay[] = [];
    // KST 자정을 UTC로 보면 전날 15시다 — 날짜만 더하면 되므로 UTC 기준으로 하루씩 민다
    const cursor = new Date(`${startKey}T00:00:00Z`);
    const last = new Date(`${endKey}T00:00:00Z`);
    while (cursor.getTime() <= last.getTime() && days.length < MAX_DAYS) {
        const key = cursor.toISOString().slice(0, 10);
        days.push({
            key,
            day: cursor.getUTCDate(),
            entered: entered.has(key),
            today: key === todayKey,
            missed: key < todayKey && !entered.has(key),
        });
        cursor.setUTCDate(cursor.getUTCDate() + 1);
    }

    return {
        leadingBlanks: new Date(`${startKey}T00:00:00Z`).getUTCDay(),
        days,
        enteredCount: days.filter((d) => d.entered).length,
    };
}
