import { formatYmd } from '@shared/utils/date';

const DAY_MS = 86_400_000;

/**
 * 설문 집계·서술 답변의 기본 조회 기간 — 미션 시작~종료(KST 달력 날짜).
 * 서버 규칙이 양끝 포함 최대 31일이라 넘으면 시작일부터 31일로 자르고 절단 여부를 알린다
 */
export function surveyDefaultRange(startsAt: string, endsAt: string) {
    const from = formatYmd(startsAt);
    const end = formatYmd(endsAt);
    const clamped = Date.parse(end) - Date.parse(from) > 30 * DAY_MS;
    const to = clamped ? new Date(Date.parse(from) + 30 * DAY_MS).toISOString().slice(0, 10) : end;
    return { from, to, clamped };
}
