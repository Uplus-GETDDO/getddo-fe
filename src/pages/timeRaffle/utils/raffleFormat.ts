import type { Event } from '@entities/event';

import {
    KST_HOUR_MINUTE,
    formatKst,
    formatKstTimeRange,
    formatRemaining,
    kstDayDiff,
} from '@shared/utils/date';

const MONTH_DAY: Intl.DateTimeFormatOptions = { month: 'long', day: 'numeric' };
const WEEKDAY: Intl.DateTimeFormatOptions = { weekday: 'short' };

/** 히어로 머리말의 오늘 날짜 — "10월 13일(월)" */
export function kstDateHeadline(now: Date): string {
    return `${formatKst(now, MONTH_DAY)}(${formatKst(now, WEEKDAY)})`;
}

/** 마감까지 남은 시간 — "9분 50초" · "1시간 23분" · "19일 23시간" (shared/utils/date formatRemaining) */
export function formatCloseCountdown(remainingMs: number): string {
    return formatRemaining(remainingMs);
}

/** KST 날짜를 '오늘 / 어제 / 내일 / 10월 3일'로 적는다 */
export function kstDayLabel(iso: string, now: Date): string {
    const diff = kstDayDiff(iso, now);
    if (diff === 0) return '오늘';
    if (diff === -1) return '어제';
    if (diff === 1) return '내일';
    return formatKst(iso, MONTH_DAY);
}

/** 오픈 예정 칩 — "오늘 20:00 오픈" */
export function formatOpenChip(event: Event, now: Date): string {
    return `${kstDayLabel(event.startsAt, now)} ${formatKst(event.startsAt, KST_HOUR_MINUTE)} 오픈`;
}

/** 진행 중 래플의 운영 시간 — 같은 날이면 "18:00 ~ 19:00", 날을 넘기면 "11월 3일 14:42 마감" */
export function formatRunningRange(event: Event): string {
    return formatKstTimeRange(event.startsAt, event.endsAt);
}

/**
 * 오픈 예정·마감 카드의 보조 설명.
 *
 * 응모권을 여러 장 쓸 수 있는지는 ADR-010의 누적 한도에 달려 있다.
 * 1회 차감량이 한도와 같으면 한 번뿐이므로 '여러 장'이라고 적을 수 없다.
 */
export function formatEntryRule(event: Event, ticketLimit: number): string {
    // 목록 응답에는 경품이 없어 당첨 인원을 모를 수 있다 — 모르면 문구를 뺀다
    const winners =
        event.winnerCount != null ? `당첨 ${event.winnerCount.toLocaleString('ko-KR')}명` : null;
    const rule =
        event.requiredTickets === 0
            ? '응모권 없이 참여'
            : event.requiredTickets * 2 > ticketLimit
              ? `응모권 ${event.requiredTickets}장으로 응모`
              : '여러 장 응모 가능';
    return winners ? `${winners} · ${rule}` : rule;
}
