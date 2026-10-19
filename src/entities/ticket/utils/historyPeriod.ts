import {
    formatYmd,
    kstDateStartUtcIso,
    kstNextDateStartUtcIso,
    kstNextMonthStart,
} from '@shared/utils/date';

export function ticketDayRange(now: Date) {
    const day = formatYmd(now.toISOString());
    return { from: kstDateStartUtcIso(day), to: kstNextDateStartUtcIso(day) };
}

export function ticketMonthRange(now: Date) {
    const monthStart = `${formatYmd(now.toISOString()).slice(0, 7)}-01`;
    return { from: kstDateStartUtcIso(monthStart), to: kstNextMonthStart(now).toISOString() };
}
