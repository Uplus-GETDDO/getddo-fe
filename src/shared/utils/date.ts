export const KST_TIME_ZONE = 'Asia/Seoul';
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

/** UTC Date/ISO 문자열을 KST 기준으로 포맷한다 (기본: 2026. 9. 17. 오후 3:00) */
export function formatKst(
    date: Date | string,
    options: Intl.DateTimeFormatOptions = {
        year: 'numeric',
        month: 'numeric',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
    },
) {
    const d = typeof date === 'string' ? new Date(date) : date;
    return new Intl.DateTimeFormat('ko-KR', { timeZone: KST_TIME_ZONE, ...options }).format(d);
}

/**
 * "09:00" 형태로 시·분만 표시하는 formatKst 옵션.
 * 오픈·마감 시각을 분 단위까지 맞춰 읽어야 하는 타임래플 화면에서 쓴다.
 * 홈 카드처럼 앞자리 0을 떼고 "9:00"으로 보여야 하는 곳은 hour: 'numeric'을 따로 넘긴다.
 */
export const KST_HOUR_MINUTE: Intl.DateTimeFormatOptions = {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
};

/**
 * epoch을 +9시간 이동시킨 Date를 반환한다.
 * 반환값의 UTC 메서드(getUTCFullYear, getUTCHours, getUTCDate 등)가 KST 시각을 가리키므로
 * "KST 기준 같은 날짜인가" 같은 비교에 사용한다. 화면 표시에는 formatKst를 쓸 것.
 */
export function toKst(date: Date | string): Date {
    const d = typeof date === 'string' ? new Date(date) : date;
    return new Date(d.getTime() + KST_OFFSET_MS);
}

/** 표시용 "2026-09-01" 형태로 포맷한다 (KST 기준 달력 날짜) */
export function formatYmd(date: string): string {
    const d = toKst(date);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

/** KST 달력 날짜 기준 D-day를 계산한다 (마감 당일 = D-0, 표시용 — 마감 판정에는 사용하지 않는다) */
export function kstDayDiff(endIso: string, now: Date): number {
    const DAY_MS = 24 * 60 * 60 * 1000;
    const end = toKst(endIso);
    const n = toKst(now);
    const endDay = Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate());
    const nowDay = Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate());
    return Math.round((endDay - nowDay) / DAY_MS);
}

/** 두 시각이 KST 기준으로 같은 날짜인지 비교한다 */
export function isSameKstDate(a: Date | string, b: Date | string): boolean {
    const ka = toKst(a);
    const kb = toKst(b);
    return (
        ka.getUTCFullYear() === kb.getUTCFullYear() &&
        ka.getUTCMonth() === kb.getUTCMonth() &&
        ka.getUTCDate() === kb.getUTCDate()
    );
}

/** 다음 달 1일 00:00 KST 시각 — 월 경계에 만료하는 항목(응모권 등)의 만료 일시 표시용 */
export function kstNextMonthStart(now: Date): Date {
    const k = toKst(now);
    return new Date(Date.UTC(k.getUTCFullYear(), k.getUTCMonth() + 1, 1) - KST_OFFSET_MS);
}

/** 남은 밀리초를 "HH:MM:SS" 형태의 카운트다운 문자열로 변환한다 (표시용 — 마감 판정에는 사용하지 않는다) */
export function formatCountdown(remainingMs: number): string {
    const totalSeconds = Math.max(0, Math.floor(remainingMs / 1000));
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}

/**
 * 남은 시간을 읽는 단위로 적는다 — "7일 2시간" · "1시간 23분" · "9분 50초".
 *
 * 시각 꼴(169:59:58)은 하루가 넘으면 셈을 해야 읽힌다. 큰 단위 둘까지만 적고,
 * 1분마다 다시 그리는 곳은 precision을 'minute'로 두어 멈춰 보이는 초를 적지 않는다.
 */
export function formatRemaining(
    remainingMs: number,
    precision: 'second' | 'minute' = 'second',
): string {
    const ms = Math.max(0, remainingMs);
    if (precision === 'minute') {
        // 남은 몫을 분으로 올려 센다 — 0은 0분, 60,001ms는 2분
        const totalMinutes = Math.ceil(ms / 60_000);
        const days = Math.floor(totalMinutes / 1440);
        const hours = Math.floor((totalMinutes % 1440) / 60);
        if (days > 0) return hours > 0 ? `${days}일 ${hours}시간` : `${days}일`;
        if (hours > 0) return `${hours}시간 ${totalMinutes % 60}분`;
        return `${totalMinutes}분`;
    }

    const totalSeconds = Math.floor(ms / 1000);
    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    if (days > 0) return hours > 0 ? `${days}일 ${hours}시간` : `${days}일`;
    if (hours > 0) return `${hours}시간 ${minutes}분`;
    if (minutes > 0) return `${minutes}분 ${seconds}초`;
    return `${seconds}초`;
}

/**
 * 운영 시간 — 같은 날 열고 닫으면 "14:00 ~ 15:00", 날을 넘기면 "11월 3일 14:42 마감".
 * 여러 날짜에 걸친 래플을 시각만 적으면 "14:42 ~ 14:42"처럼 같은 시각으로 보였다
 */
export function formatKstTimeRange(startIso: string, endIso: string): string {
    if (isSameKstDate(startIso, endIso)) {
        return `${formatKst(startIso, KST_HOUR_MINUTE)} ~ ${formatKst(endIso, KST_HOUR_MINUTE)}`;
    }
    return `${formatKst(endIso, { month: 'long', day: 'numeric' })} ${formatKst(endIso, KST_HOUR_MINUTE)} 마감`;
}

/**
 * `datetime-local` 입력값("YYYY-MM-DDTHH:mm")을 KST로 해석해 UTC ISO 문자열로 변환한다.
 * 관리자가 화면에 입력하는 운영 시각은 KST 기준이다 (getddo-spec 기능 요구사항 공통 시간 기준).
 */
export function kstInputToUtcIso(local: string): string {
    const withSeconds = local.length === 16 ? `${local}:00` : local;
    return new Date(`${withSeconds}+09:00`).toISOString();
}

/** 날짜 입력("YYYY-MM-DD")을 그날 00:00 KST의 UTC ISO로 바꾼다 — `[from, to)` 구간의 시작 */
export function kstDateStartUtcIso(ymd: string): string {
    return kstInputToUtcIso(`${ymd}T00:00`);
}

/** 날짜 입력("YYYY-MM-DD")을 다음 날 00:00 KST의 UTC ISO로 바꾼다 — 종료일을 포함하는 `[from, to)` 구간의 상한 */
export function kstNextDateStartUtcIso(ymd: string): string {
    const d = new Date(kstDateStartUtcIso(ymd));
    d.setUTCDate(d.getUTCDate() + 1);
    return d.toISOString();
}

/** UTC ISO 문자열을 `datetime-local` 입력값("YYYY-MM-DDTHH:mm", KST 기준)으로 되돌린다 — 폼 초기값용 */
export function utcIsoToKstInput(iso: string): string {
    const k = toKst(iso);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${k.getUTCFullYear()}-${pad(k.getUTCMonth() + 1)}-${pad(k.getUTCDate())}T${pad(k.getUTCHours())}:${pad(k.getUTCMinutes())}`;
}

/** now 기준 상대 시간 문자열을 만든다. "지금"의 기준은 호출부가 useVirtualClock().now()로 넘겨준다 */
export function formatRelativeFromNow(date: Date | string, now: Date): string {
    const target = typeof date === 'string' ? new Date(date) : date;
    const diffMinutes = Math.floor((now.getTime() - target.getTime()) / 60_000);
    if (diffMinutes < 1) return '방금 전';
    if (diffMinutes < 60) return `${diffMinutes}분 전`;
    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) return `${diffHours}시간 전`;
    return `${Math.floor(diffHours / 24)}일 전`;
}

/** "09.17" 또는 시각까지 "09.17 20:05" 형태로 포맷한다 (KST) — 목록의 짧은 날짜 표기 */
export function formatKstDot(date: Date | string, withTime = false): string {
    const k = toKst(date);
    const pad = (n: number) => String(n).padStart(2, '0');
    const day = `${pad(k.getUTCMonth() + 1)}.${pad(k.getUTCDate())}`;
    return withTime ? `${day} ${pad(k.getUTCHours())}:${pad(k.getUTCMinutes())}` : day;
}

/** KST 하루 구간 — 날짜("YYYY-MM-DD")와 그날 00:00~다음 날 00:00의 `[from, to)` UTC ISO */
export interface KstDayRange {
    ymd: string;
    from: string;
    to: string;
}

/** now가 속한 KST 날짜까지 최근 days일의 하루 구간 — 오래된 날부터 (관리자 대시보드 일별 집계) */
export function recentKstDays(now: Date, days: number): KstDayRange[] {
    const todayStart = new Date(kstDateStartUtcIso(formatYmd(now.toISOString())));
    return Array.from({ length: days }, (_, index) => {
        const from = new Date(todayStart);
        from.setUTCDate(from.getUTCDate() - (days - 1 - index));
        const ymd = formatYmd(from.toISOString());
        return { ymd, from: from.toISOString(), to: kstNextDateStartUtcIso(ymd) };
    });
}

/**
 * 주소 조건 등으로 받은 날짜 문자열이 달력에 있는 "YYYY-MM-DD"면 그대로, 아니면 null (대시보드 → 목록 날짜 필터 연결).
 * 2026-02-31처럼 꼴만 맞는 날짜는 다음 달로 넘어가거나(조회 범위가 틀어짐) 13월처럼 변환 중 오류가 나므로 거른다
 */
export function parseYmd(value: string | null): string | null {
    const match = value ? /^(\d{4})-(\d{2})-(\d{2})$/.exec(value) : null;
    if (!match) return null;
    const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
    const date = new Date(Date.UTC(year, month - 1, day));
    const valid =
        date.getUTCFullYear() === year &&
        date.getUTCMonth() === month - 1 &&
        date.getUTCDate() === day;
    return valid ? value : null;
}
