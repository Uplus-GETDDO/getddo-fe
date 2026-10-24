import { http } from 'msw';

import type { AbuseCaseDetail } from '@entities/abuseCase';

import { env } from '@shared/config/env';

import { DAY, MINUTE, demoTime } from '../demoTime';
import { fail, ok } from './response';

const api = (path: string) => `${env.apiBaseUrl}${path}`;

/*
 * 목업 세션 동안 유지되는 차단 기록 — 실제 자동 일시 차단이 시작된 이력만 남는다.
 * 단순 탐지·검토 기록이나 차단되지 않고 지급된 요청은 이 기록에 나타나지 않는다 (spec AR01·AR02).
 * blockedUntil은 차단 종료 예정 시각이며 지금도 차단 중인지의 보장 값이 아니다
 */
const abuseCases: AbuseCaseDetail[] = [
    {
        id: 'a0000000-0000-4000-8000-000000000001',
        userId: '10000000-0000-4000-8000-000000001042',
        userNickname: '빠른손김철수',
        eventId: '20000000-0000-4000-8000-000000000201',
        eventTitle: '닌텐도 스위치 2 래플',
        sourceType: 'ENTRY',
        detectionType: 'REPEATED_RATE_LIMIT_EXCEEDED',
        detectionReason: '1분 내 응모 요청 거절 10회 누적 — 10분 일시 차단',
        blockedAt: demoTime(-5 * DAY),
        blockedUntil: demoTime(-5 * DAY + 10 * MINUTE),
        evidence: {
            ruleVersion: 'v1',
            triggerScope: 'EVENT',
            windowStartedAt: demoTime(-5 * DAY - MINUTE),
            windowEndsAt: demoTime(-5 * DAY),
            requestLimit: 10,
            rejectedCount: 10,
            rejectionThreshold: 10,
        },
    },
    {
        id: 'a0000000-0000-4000-8000-000000000002',
        userId: '10000000-0000-4000-8000-000000002017',
        userNickname: '자동화테스트',
        eventId: '20000000-0000-4000-8000-000000000187',
        eventTitle: '스타벅스 e카드 래플',
        sourceType: 'ENTRY',
        detectionType: 'REPEATED_RATE_LIMIT_EXCEEDED',
        detectionReason: '1분 내 응모 요청 거절 12회 누적 — 10분 일시 차단',
        blockedAt: demoTime(-6 * DAY),
        blockedUntil: demoTime(-6 * DAY + 10 * MINUTE),
        evidence: {
            ruleVersion: 'v1',
            triggerScope: 'EVENT',
            windowStartedAt: demoTime(-6 * DAY - MINUTE),
            windowEndsAt: demoTime(-6 * DAY),
            requestLimit: 10,
            rejectedCount: 12,
            rejectionThreshold: 10,
        },
    },
    {
        id: 'a0000000-0000-4000-8000-000000000003',
        userId: '10000000-0000-4000-8000-000000000455',
        userNickname: '다계정의심',
        eventId: null,
        eventTitle: null,
        sourceType: 'ENTRY',
        detectionType: 'REPEATED_RATE_LIMIT_EXCEEDED',
        detectionReason: '사용자 기준 1분 내 응모 요청 거절 25회 누적 — 30분 일시 차단',
        blockedAt: demoTime(-7 * DAY),
        blockedUntil: demoTime(-7 * DAY + 30 * MINUTE),
        evidence: {
            ruleVersion: 'v1',
            triggerScope: 'USER',
            windowStartedAt: demoTime(-7 * DAY - MINUTE),
            windowEndsAt: demoTime(-7 * DAY),
            requestLimit: 20,
            rejectedCount: 25,
            rejectionThreshold: 20,
        },
    },
    {
        id: 'a0000000-0000-4000-8000-000000000004',
        userId: '10000000-0000-4000-8000-000000001042',
        userNickname: '빠른손김철수',
        eventId: '20000000-0000-4000-8000-000000000099',
        eventTitle: 'VVIP 데이터 쿠폰 래플',
        sourceType: 'ENTRY',
        detectionType: 'REPEATED_RATE_LIMIT_EXCEEDED',
        detectionReason: '1분 내 응모 요청 거절 10회 누적 — 10분 일시 차단',
        blockedAt: demoTime(-10 * DAY),
        blockedUntil: demoTime(-10 * DAY + 10 * MINUTE),
        evidence: {
            ruleVersion: 'v1',
            triggerScope: 'EVENT',
            windowStartedAt: demoTime(-10 * DAY - MINUTE),
            windowEndsAt: demoTime(-10 * DAY),
            requestLimit: 10,
            rejectedCount: 10,
            rejectionThreshold: 10,
        },
    },
];

const badQuery = () => fail(400, 'COMMON-002', '조회 조건이 올바르지 않습니다.');
const TZ_SUFFIX = /(Z|[+-]\d{2}:?\d{2})$/;

// 날짜 필터는 blockedAt 기준 [from, to) — 시간대 없는 값은 받지 않는다 (spec 공통 계약)
// 오프셋 표기(+09:00)도 같은 순간으로 비교해야 하므로 문자열이 아닌 밀리초로 내린다
function parseRange(params: URLSearchParams): { from: number | null; to: number | null } | null {
    const from = params.get('from');
    const to = params.get('to');
    const fromMs = from === null ? null : Date.parse(from);
    const toMs = to === null ? null : Date.parse(to);
    for (const [value, milliseconds] of [
        [from, fromMs],
        [to, toMs],
    ] as const) {
        if (value !== null && (!TZ_SUFFIX.test(value) || Number.isNaN(milliseconds))) {
            return null;
        }
    }
    if (fromMs !== null && toMs !== null && fromMs >= toMs) return null;
    return { from: fromMs, to: toMs };
}

// 페이지는 1부터, size는 1~100(기본 20) — 공통 계약의 Page 제안을 따른다
function paginate(rows: AbuseCaseDetail[], params: URLSearchParams) {
    const page = Number(params.get('page') ?? 1);
    const size = Number(params.get('size') ?? 20);
    if (!Number.isInteger(page) || page < 1 || !Number.isInteger(size) || size < 1 || size > 100) {
        return null;
    }
    return {
        items: rows.slice((page - 1) * size, page * size),
        page,
        size,
        totalElements: rows.length,
    };
}

export const abuseHandlers = [
    // AR01 — Page 봉투. 기본 정렬은 blockedAt DESC, id DESC다
    http.get(api('/v1/admin/abuse-cases'), ({ request }) => {
        const url = new URL(request.url);
        const params = url.searchParams;
        const range = parseRange(params);
        if (!range) return badQuery();
        const userId = params.get('userId');
        const eventId = params.get('eventId');
        const sourceType = params.get('sourceType');

        const filtered = abuseCases
            .filter((item) => {
                if (userId && item.userId !== userId) return false;
                if (eventId && item.eventId !== eventId) return false;
                if (sourceType && item.sourceType !== sourceType) return false;
                const blockedMs = Date.parse(item.blockedAt);
                if (range.from !== null && blockedMs < range.from) return false;
                if (range.to !== null && blockedMs >= range.to) return false;
                return true;
            })
            .sort((a, b) => b.blockedAt.localeCompare(a.blockedAt) || b.id.localeCompare(a.id));
        const page = paginate(filtered, params);
        if (!page) return badQuery();
        return ok(page);
    }),
    // AR02 — AbuseCaseDetail: 요약 필드에 차단 판정 근거(evidence)를 관리자 전용으로 내린다
    http.get(api('/v1/admin/abuse-cases/:caseId'), ({ params }) => {
        const target = abuseCases.find((c) => c.id === params.caseId);
        if (!target) {
            return fail(404, 'RESOURCE_NOT_FOUND', '차단 내역을 찾을 수 없습니다');
        }
        return ok(target);
    }),
];
