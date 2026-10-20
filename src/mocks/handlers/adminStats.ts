import { http } from 'msw';

import { env } from '@shared/config/env';

import { fail, ok } from './response';

const api = (path: string) => `${env.apiBaseUrl}${path}`;

const DAY_MS = 86_400_000;

// AS01 목업 — 기간의 모든 날짜를 오름차순으로 채우고 활동 없는 날은 0이다.
// blockedCount는 '탐지 기록 수'이고 totalUserCount는 조회 시점의 활성 일반 사용자 수다.
export const adminStatsHandlers = [
    http.get(api('/v1/admin/stats/daily'), ({ request }) => {
        const params = new URL(request.url).searchParams;
        const from = params.get('from');
        const to = params.get('to');
        if (!from || !to || !/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
            return fail(400, 'COMMON-005', '요청 형식이 올바르지 않습니다.');
        }
        const days = Math.round((Date.parse(to) - Date.parse(from)) / DAY_MS) + 1;
        if (days < 1 || days > 31) {
            return fail(400, 'STATS-001', '조회 기간이 올바르지 않습니다.');
        }
        return ok({
            days: Array.from({ length: days }, (_, i) => ({
                date: new Date(Date.parse(from) + i * DAY_MS).toISOString().slice(0, 10),
                entrantCount: i + 1,
                entryCount: (i + 1) * 2,
                activeUserCount: i + 1,
                grantedTickets: {
                    ATTENDANCE: (i + 1) * 10,
                    MISSION: (i + 1) * 5,
                    GAME: (i + 1) * 3,
                },
                usedTickets: (i + 1) * 4,
                blockedCount: i,
            })),
            totalUserCount: 12,
        });
    }),
];
