import { http, HttpResponse } from 'msw';

import type { Entry, TicketsByGrade } from '@entities/entry';
import type { MembershipRule } from '@entities/event';
import type { TicketGrade } from '@entities/ticket';

import { ticketGradeSchema } from '@entities/ticket';
import { env } from '@shared/config/env';
import { IDEMPOTENCY_HEADER } from '@shared/utils/idempotencyKey';

import { mockNow } from '../now';
import {
    entryRuleOf,
    findMockEvent,
    getMockEventStatistics,
    mockEventEffectiveStatus,
    recordMockEventEntry,
} from './event';
import { fail, failBody, ok, okBody } from './response';
import { getMockAvailableTicketCountByGrade, recordMockTicketUse } from './ticket';
import { findMockVirtualUser } from './virtualUsers';

const api = (path: string) => `${env.apiBaseUrl}${path}`;

// getddo-spec/05-api/entry.md 초안의 EntryReceipt — 계약 기준은 entities/entry의 entrySchema다
type EntryReceipt = Entry;

// 멤버십 규칙 비교 — 우수 < VIP < VVIP (getddo-spec 02-domain/event.md)
const MEMBERSHIP_RANK: Record<MembershipRule, number> = { excellent: 0, vip: 1, vvip: 2 };

const ZERO_TICKETS: TicketsByGrade = { BRONZE: 0, SILVER: 0, GOLD: 0 };

/**
 * E04 요청 본문의 tickets 맵을 세 등급이 채워진 모양으로 정규화한다 — 생략된 등급은 0이다.
 * 등급 외 키·정수가 아닌 값·음수가 있으면 형식 오류(null)다 (spec EntryRequest)
 */
function parseTickets(raw: unknown): TicketsByGrade | null {
    if (raw === undefined) return { ...ZERO_TICKETS };
    if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return null;
    const tickets: TicketsByGrade = { ...ZERO_TICKETS };
    for (const [key, value] of Object.entries(raw)) {
        if (!(ticketGradeSchema.options as readonly string[]).includes(key)) return null;
        if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) return null;
        tickets[key as TicketGrade] = value;
    }
    return tickets;
}

const totalOf = (tickets: TicketsByGrade) => tickets.BRONZE + tickets.SILVER + tickets.GOLD;

const sameTickets = (a: TicketsByGrade, b: TicketsByGrade) =>
    ticketGradeSchema.options.every((grade) => a[grade] === b[grade]);

/**
 * 멱등키에 묶인 처음 처리 결과 — 성공뿐 아니라 업무 거절(4xx)도 저장한다.
 * 같은 키·같은 본문으로 다시 오면 재처리하지 않고 저장한 응답을 그대로 돌려준다 (E04 계약)
 */
interface StoredAttempt {
    userId: string;
    eventId: string;
    tickets: TicketsByGrade;
    status: number;
    body: unknown;
}
const attempts = new Map<string, StoredAttempt>();

// GD-146 응모 빈도 제한 — 창·횟수는 담당자 운영값이라 명세에 확정값이 없다.
// 목업 재현이 되는 최소 상수로 두고 조정이 필요하면 여기만 바꾼다 (05-api/common.md)
const ENTRY_RATE_LIMIT_WINDOW_MS = 10_000;
const ENTRY_RATE_LIMIT_MAX_REQUESTS = 5;
const ENTRY_RATE_LIMIT_RETRY_AFTER_SECONDS = 10;

// 사용자별 신규 응모 요청 시각 — 같은 멱등키의 정상 재전송은 기록하지 않는다.
// 가상 시계를 멈춰도 실제 요청 간격으로 제한되어야 하므로 mockNow가 아닌 실제 경과 시간을 쓴다
const entryRequestTimestamps = new Map<string, number[]>();

const isRateLimited = (userId: string, nowMs: number) => {
    const stamps = (entryRequestTimestamps.get(userId) ?? []).filter(
        (at) => nowMs - at < ENTRY_RATE_LIMIT_WINDOW_MS,
    );
    // 제한에 걸린 요청은 쿼터를 소비하지 않는다 — 창이 지나면 다시 낼 수 있다
    if (stamps.length >= ENTRY_RATE_LIMIT_MAX_REQUESTS) {
        entryRequestTimestamps.set(userId, stamps);
        return true;
    }
    stamps.push(nowMs);
    entryRequestTimestamps.set(userId, stamps);
    return false;
};

// 내 응모 내역 — X-User-ID별로 분리한다 (한 사용자의 응모가 다른 사용자에게 보이지 않도록)
const entriesByUser = new Map<string, EntryReceipt[]>();

// 첫 진입에 내역이 비지 않게 심어 두는 시드 응모 — 내역·통계·관리자 표시에는 포함하지만
// E04의 응모 제한과 E07의 참여 여부 판정에서는 실제 응모로 세지 않는다.
// 그대로 세면 모든 사용자가 evt-001에 '이미 응모' 상태로 잠겨 신규 응모 시연이 불가하다
const seededEntries = new WeakSet<EntryReceipt>();

const seedEntry = (): EntryReceipt => ({
    id: crypto.randomUUID(),
    eventId: 'evt-001',
    eventTitle: '갤럭시 버즈 위클리 래플',
    requestedTicketCount: 1,
    requestedTicketsByGrade: { BRONZE: 1, SILVER: 0, GOLD: 0 },
    deductedTicketCount: 1,
    deductedTicketsByGrade: { BRONZE: 1, SILVER: 0, GOLD: 0 },
    status: 'ACCEPTED',
    requestedAt: '2026-09-15T08:00:00Z',
    acceptedAt: '2026-09-15T08:00:00Z',
    rejectionCode: null,
    rejectionReason: null,
});

const HOUR_MS = 60 * 60 * 1000;

/**
 * 내 응모 내역 화면이 발표 대기·당첨·미당첨을 모두 보여 줄 수 있게 마감·발표된 겟또타임에 심는 시드.
 * 응모 시각은 마감 몇 시간 전으로 잡는다. 결과는 E09 목업(drawResult)이 이벤트 상태로 판정한다.
 * evt-107은 E09 테스트가 "응모하지 않은 사람"을 확인하는 래플이라 시드를 두지 않는다
 */
const DEMO_ENTRY_SEEDS: { eventId: string; tickets: TicketsByGrade; hoursBeforeEnd: number }[] = [
    { eventId: 'evt-106', tickets: { BRONZE: 0, SILVER: 2, GOLD: 1 }, hoursBeforeEnd: 2 },
    { eventId: 'evt-108', tickets: { BRONZE: 1, SILVER: 0, GOLD: 0 }, hoursBeforeEnd: 3 },
    { eventId: 'evt-110', tickets: { BRONZE: 0, SILVER: 1, GOLD: 0 }, hoursBeforeEnd: 4 },
    { eventId: 'evt-109', tickets: { BRONZE: 3, SILVER: 0, GOLD: 0 }, hoursBeforeEnd: 5 },
    { eventId: 'evt-111', tickets: { BRONZE: 0, SILVER: 2, GOLD: 0 }, hoursBeforeEnd: 1 },
    { eventId: 'evt-006', tickets: { ...ZERO_TICKETS }, hoursBeforeEnd: 24 * 20 },
];

const demoSeedEntries = (): EntryReceipt[] =>
    DEMO_ENTRY_SEEDS.flatMap(({ eventId, tickets, hoursBeforeEnd }) => {
        const event = findMockEvent(eventId);
        if (!event) return [];
        const at = new Date(
            Math.min(
                new Date(event.endsAt).getTime() - hoursBeforeEnd * HOUR_MS,
                mockNow().getTime() - HOUR_MS,
            ),
        ).toISOString();
        return [
            {
                id: crypto.randomUUID(),
                eventId,
                eventTitle: event.title,
                requestedTicketCount: totalOf(tickets),
                requestedTicketsByGrade: tickets,
                deductedTicketCount: totalOf(tickets),
                deductedTicketsByGrade: tickets,
                status: 'ACCEPTED' as const,
                requestedAt: at,
                acceptedAt: at,
                rejectionCode: null,
                rejectionReason: null,
            },
        ];
    });

const userIdOf = (request: Request) => request.headers.get('X-User-ID') ?? 'anonymous';

/** 관리자 목업이 삭제 가능 여부(응모 이력 없음, 도메인 규칙)를 판정할 때 쓴다 */
export function mockEventHasEntries(eventId: string): boolean {
    for (const list of entriesByUser.values()) {
        if (list.some((entry) => entry.eventId === eventId && entry.status === 'ACCEPTED')) {
            return true;
        }
    }
    return false;
}

/** 관리자 목업이 취소 시 사용자별 실제 차감 합계를 환불할 때 쓴다 — 시드 카운터가 아닌 접수 기록이 근거다 */
export function mockEntryTicketTotals(eventId: string): Map<string, number> {
    const totals = new Map<string, number>();
    for (const [userId, list] of entriesByUser) {
        const sum = list
            .filter((entry) => entry.eventId === eventId && entry.status === 'ACCEPTED')
            .reduce((acc, entry) => acc + entry.deductedTicketCount, 0);
        if (sum > 0) totals.set(userId, sum);
    }
    return totals;
}

const myEntriesFor = (userId: string) => {
    let list = entriesByUser.get(userId);
    if (!list) {
        // 시연 첫 진입에도 목록이 비어 보이지 않게 사용자별 시드 하나를 둔다
        list = [seedEntry(), ...demoSeedEntries()];
        for (const seed of list) seededEntries.add(seed);
        entriesByUser.set(userId, list);
    }
    return list;
};

/** 이 이벤트에 접수된 내 응모 — E06 내역·E03 통계·관리자 표시처럼 시드를 포함해 보여줄 때 쓴다 */
const myAcceptedFor = (userId: string, eventId: string) =>
    myEntriesFor(userId).filter(
        (entry) => entry.eventId === eventId && entry.status === 'ACCEPTED',
    );

/** 실제로 접수된 응모만 센다 — E04의 1회 제한·누적 상한과 E07의 참여 판정 근거 */
const myRealAcceptedFor = (userId: string, eventId: string) =>
    myAcceptedFor(userId, eventId).filter((entry) => !seededEntries.has(entry));

const usedTicketCountOf = (userId: string, eventId: string) =>
    myAcceptedFor(userId, eventId).reduce((sum, entry) => sum + entry.deductedTicketCount, 0);

const usedRealTicketCountOf = (userId: string, eventId: string) =>
    myRealAcceptedFor(userId, eventId).reduce((sum, entry) => sum + entry.deductedTicketCount, 0);

/**
 * E09 목업이 본인 응모 여부·차감 합계를 판정할 때 쓴다.
 *
 * 응모하지 않은 사람에게 낙첨이라고 적으면 안 되므로 NOT_ENTERED와 LOST를 가르는 근거다.
 * 시드 응모도 '내 응모'로 센다 — 내역 화면이 보여 주는 것과 같은 기준이어야 한다.
 */
export function mockMyEntrySummary(userId: string, eventId: string) {
    const accepted = myAcceptedFor(userId, eventId);
    return {
        entryCount: accepted.length,
        ticketCount: accepted.reduce((sum, entry) => sum + entry.deductedTicketCount, 0),
    };
}

/**
 * 이 이벤트에 응모한 사용자 ID를 먼저 응모한 순서로 돌려준다.
 *
 * E09 목업이 당첨 자리를 사용자에게 겹치지 않게 배정할 때 쓴다 — 자리 수는 공개 명단(E08)의
 * 당첨 인원과 같아야 하므로, 사용자마다 따로 뽑으면 1등이 여럿 나올 수 있다.
 */
export function mockEventEntrantIds(eventId: string): string[] {
    const firstAcceptedAt = new Map<string, number>();
    for (const [userId, list] of entriesByUser) {
        for (const entry of list) {
            if (entry.eventId !== eventId || entry.status !== 'ACCEPTED') continue;
            const at = new Date(entry.acceptedAt ?? entry.requestedAt).getTime();
            const seen = firstAcceptedAt.get(userId);
            if (seen == null || at < seen) firstAcceptedAt.set(userId, at);
        }
    }
    return [...firstAcceptedAt.entries()].sort((a, b) => a[1] - b[1]).map(([userId]) => userId);
}

export const entryHandlers = [
    // E06 초안 — Page<EntryReceipt> 봉투, page·size 파라미터를 적용한다 (페이지는 1부터)
    http.get(api('/v1/users/me/entries'), ({ request }) => {
        const all = myEntriesFor(userIdOf(request));
        const url = new URL(request.url);
        const page = Math.max(1, Number(url.searchParams.get('page')) || 1);
        const size = Math.max(1, Number(url.searchParams.get('size')) || 20);
        return ok({
            items: all.slice((page - 1) * size, page * size),
            page,
            size,
            totalElements: all.length,
        });
    }),
    // E05 초안 — 이벤트별 내 응모 내역. 거절 이력도 같은 영수증 목록으로 돌려준다 (GD-145)
    http.get(api('/v1/events/:eventId/entries/me'), ({ params, request }) => {
        const url = new URL(request.url);
        const page = Math.max(1, Number(url.searchParams.get('page')) || 1);
        const size = Math.max(1, Number(url.searchParams.get('size')) || 20);
        const all = myEntriesFor(userIdOf(request)).filter(
            (entry) => entry.eventId === String(params.eventId),
        );
        return ok({
            items: all.slice((page - 1) * size, page * size),
            page,
            size,
            totalElements: all.length,
        });
    }),
    // E03 — 이벤트별 응모 현황. 당첨 확률은 반환하지 않는다
    http.get(api('/v1/events/:eventId/statistics'), ({ params, request }) => {
        const event = findMockEvent(String(params.eventId));
        if (!event) {
            return fail(404, 'ENTRY-004', '이벤트를 찾을 수 없습니다');
        }
        // 본인 차감 수는 공유 이벤트 카운터가 아니라 요청 사용자의 접수 기록에서 센다
        const mySpentTicketCount = usedTicketCountOf(userIdOf(request), event.id);
        return ok({ ...getMockEventStatistics(event), mySpentTicketCount });
    }),
    // E07 — 응모 자격 조회. 서버가 판정한 불가 사유를 모두 돌려준다 (화면은 사전 차단보다 결과 안내에 쓴다)
    http.get(api('/v1/events/:eventId/eligibility'), ({ params, request }) => {
        const event = findMockEvent(String(params.eventId));
        if (!event) {
            return fail(404, 'ENTRY-004', '이벤트를 찾을 수 없습니다');
        }
        const userId = userIdOf(request);
        const user = findMockVirtualUser(userId);
        const rule = entryRuleOf(event);
        const reasons: string[] = [];

        if (user?.role === 'ADMIN') reasons.push('ADMIN_ENTRY_FORBIDDEN');
        if (
            MEMBERSHIP_RANK[user?.membership ?? 'excellent'] < MEMBERSHIP_RANK[rule.membershipRule]
        ) {
            reasons.push('ENTRY_MEMBERSHIP_NOT_MET');
        }
        if (mockEventEffectiveStatus(event) !== 'open') reasons.push('EVENT_NOT_OPEN');

        const usedTicketCount = usedRealTicketCountOf(userId, event.id);
        const onceOnly = rule.eventType === 'NO_TICKET' || !rule.weightingEnabled;
        if (onceOnly && myRealAcceptedFor(userId, event.id).length > 0) {
            reasons.push('ALREADY_ENTERED');
        }

        const availableByGrade = getMockAvailableTicketCountByGrade(userId);
        if (rule.eventType === 'TICKET') {
            if (rule.weightingEnabled) {
                if (rule.maxTicketsPerUser !== null && usedTicketCount >= rule.maxTicketsPerUser) {
                    reasons.push('TICKET_LIMIT_EXCEEDED');
                }
                if (totalOf(availableByGrade) < 1) reasons.push('INSUFFICIENT_TICKETS');
            } else if (availableByGrade.BRONZE < 1) {
                reasons.push('BRONZE_REQUIRED');
            }
        }

        // 미사용 이벤트는 수량 관련 값이 0이다 — 1회 제한은 reasons·canEnter로 확인한다 (spec E07)
        const isFree = rule.eventType === 'NO_TICKET';
        const remainingTicketLimit = isFree
            ? 0
            : rule.maxTicketsPerUser === null
              ? null
              : Math.max(0, rule.maxTicketsPerUser - usedTicketCount);
        const availableTicketBalance = isFree
            ? 0
            : rule.weightingEnabled
              ? totalOf(availableByGrade)
              : availableByGrade.BRONZE;

        return ok({
            eventId: event.id,
            canEnter: reasons.length === 0,
            reasons,
            usedTicketCount,
            remainingTicketLimit,
            availableTicketBalance,
            serverTime: mockNow().toISOString(),
        });
    }),
    // E04 — 응모 접수. 등급별 장수 맵(tickets)을 이벤트 유형별 규칙으로 검증해 차감한다 (GD-150)
    http.post(api('/v1/events/:eventId/entries'), async ({ params, request }) => {
        const idempotencyKey = request.headers.get(IDEMPOTENCY_HEADER);
        if (!idempotencyKey) {
            return fail(400, 'COMMON-002', '멱등키가 필요합니다');
        }
        const userId = userIdOf(request);
        const eventId = String(params.eventId);

        const body = (await request.json().catch(() => null)) as { tickets?: unknown } | null;

        // GD-146 — 429 응답. 정상 재전송을 제외한 모든 요청이 창을 세며, 실제 경과 시간을 쓴다
        const rateLimited = () => {
            if (!isRateLimited(userId, Date.now())) return null;
            return HttpResponse.json(
                failBody(
                    'RATE_LIMIT_EXCEEDED',
                    '요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.',
                ),
                {
                    status: 429,
                    headers: { 'Retry-After': String(ENTRY_RATE_LIMIT_RETRY_AFTER_SECONDS) },
                },
            );
        };

        // 멱등키 재생은 페이로드 규칙보다 먼저다 — 재전송은 처음 결과를 그대로 돌려준다 (E04)
        const attempt = attempts.get(idempotencyKey);
        if (attempt) {
            const sameActor = attempt.userId === userId && attempt.eventId === eventId;
            const retried = parseTickets(body?.tickets);
            // 본문을 못 읽거나 읽은 내용이 같으면 재전송, 그 외는 같은 키의 다른 요청이다
            const isReplay = sameActor && (!retried || sameTickets(attempt.tickets, retried));
            if (isReplay) {
                // 이미 접수된 건의 재전송이므로 201은 200으로 내려준다
                const status = attempt.status === 201 ? 200 : attempt.status;
                return HttpResponse.json(attempt.body as object, { status });
            }
            // 다른 요청은 재전송이 아니므로 빈도 제한에 포함한다
            const limited = rateLimited();
            if (limited) {
                return limited;
            }
            return fail(409, 'ENTRY-009', '같은 멱등키로 다른 응모를 보낼 수 없습니다');
        }

        // 사용자별 응모 빈도 제한 — 멱등키 재생은 위에서 먼저 반환돼 여기는 새 요청만 온다
        const limited = rateLimited();
        if (limited) {
            return limited;
        }

        const tickets = parseTickets(body?.tickets);
        if (!tickets) {
            return fail(400, 'ENTRY-001', '응모권 장수 맵이 올바르지 않습니다');
        }

        // 여기서부터는 키에 처음 묶이는 새 요청 — 업무 거절도 결과를 키에 저장한다
        const remember = (status: number, responseBody: unknown) => {
            attempts.set(idempotencyKey, {
                userId,
                eventId,
                tickets,
                status,
                body: responseBody,
            });
            return HttpResponse.json(responseBody as object, { status });
        };

        const event = findMockEvent(eventId);
        if (!event) {
            return remember(404, failBody('ENTRY-004', '이벤트를 찾을 수 없습니다'));
        }
        const rule = entryRuleOf(event);
        const total = totalOf(tickets);

        // 업무 거절은 REJECTED 영수증으로도 남겨 E05/E06에서 조회되게 한다 (GD-145).
        // 거절은 응모권을 차감하지 않으므로 차감 장수는 모두 0이다 (spec EntryReceipt)
        const reject = (status: number, code: string, reason: string) => {
            myEntriesFor(userId).unshift({
                id: idempotencyKey,
                eventId,
                eventTitle: event.title,
                requestedTicketCount: total,
                requestedTicketsByGrade: { ...tickets },
                deductedTicketCount: 0,
                deductedTicketsByGrade: { ...ZERO_TICKETS },
                status: 'REJECTED',
                requestedAt: mockNow().toISOString(),
                acceptedAt: null,
                rejectionCode: code,
                rejectionReason: reason,
            });
            return remember(status, failBody(code, reason));
        };

        // 시연용 사용자 문맥 — 헤더 멤버십이 오면 등록된 멤버십과 같아야 한다 (05-api/common.md)
        const user = findMockVirtualUser(userId);
        const requestedMembership = request.headers.get('X-User-Membership');
        if (user && requestedMembership && requestedMembership !== user.membership) {
            // 멤버십 불일치는 응모 시도 전의 사용자 문맥 오류라 거절 이력으로 저장하지 않는다 —
            // 저장하면 헤더를 고친 재시도까지 옛 거절로 막힌다
            return fail(409, 'USER-006', '사용자 멤버십 정보가 일치하지 않습니다');
        }
        if (user?.role === 'ADMIN') {
            return reject(403, 'ENTRY-002', '관리자는 이벤트에 응모할 수 없습니다');
        }
        if (
            MEMBERSHIP_RANK[user?.membership ?? 'excellent'] < MEMBERSHIP_RANK[rule.membershipRule]
        ) {
            return reject(403, 'ENTRY-003', '응모 가능한 멤버십 등급이 아닙니다');
        }
        if (mockEventEffectiveStatus(event) !== 'open') {
            return reject(409, 'ENTRY-005', '지금은 응모할 수 있는 시간이 아닙니다');
        }

        // 사용자당 1회 제한 — 미사용·가중치 미적용 이벤트
        const onceOnly = rule.eventType === 'NO_TICKET' || !rule.weightingEnabled;
        if (onceOnly && myRealAcceptedFor(userId, eventId).length > 0) {
            return reject(409, 'ENTRY-006', '이미 응모한 이벤트입니다');
        }

        if (rule.eventType === 'NO_TICKET') {
            if (total !== 0) {
                // ENTRY-001은 형식 오류라 업무 거절 이력에 남기지 않는다 — 멱등 재생만 저장한다
                return remember(
                    400,
                    failBody('ENTRY-001', '응모권 미사용 이벤트는 응모권을 쓸 수 없습니다'),
                );
            }
        } else if (!rule.weightingEnabled) {
            // 브론즈 1장 고정 — 다른 등급·장수나 브론즈 부족은 모두 BRONZE_REQUIRED로 구분 안내한다
            const bronzeOnly = tickets.BRONZE === 1 && tickets.SILVER === 0 && tickets.GOLD === 0;
            if (!bronzeOnly || getMockAvailableTicketCountByGrade(userId).BRONZE < 1) {
                return reject(
                    409,
                    'ENTRY-008',
                    '이 이벤트는 브론즈 응모권 1장으로만 응모할 수 있습니다',
                );
            }
        } else {
            if (total < 1) {
                return remember(400, failBody('ENTRY-001', '응모권을 1장 이상 골라야 합니다'));
            }
            // 누적 상한은 시드 카운터가 아닌 접수 기록으로 센다 — 월말 소진용(null)은 상한이 없다
            if (
                rule.maxTicketsPerUser !== null &&
                usedRealTicketCountOf(userId, eventId) + total > rule.maxTicketsPerUser
            ) {
                return reject(409, 'ENTRY-007', '이 이벤트의 응모 한도를 초과했습니다');
            }
            const available = getMockAvailableTicketCountByGrade(userId);
            const lacksGrade = ticketGradeSchema.options.some(
                (grade) => tickets[grade] > available[grade],
            );
            if (lacksGrade) {
                return reject(409, 'TICKET-006', '등급별 보유 응모권이 부족합니다');
            }
        }

        // 영수증 ID는 멱등키다 — 같은 키의 재전송이 같은 접수 건을 가리키게 한다 (ADR-0005)
        const entryId = idempotencyKey;
        recordMockEventEntry(event, total);
        if (total > 0) {
            // 한 응모에 여러 등급을 쓰면 장마다 USE 이력이 생기고 같은 eventEntryId를 가진다 (spec T02)
            recordMockTicketUse(userId, tickets, `${event.title} 응모`, {
                eventId,
                eventEntryId: entryId,
            });
        }

        const now = mockNow().toISOString();
        const responseBody: EntryReceipt = {
            id: entryId,
            eventId,
            eventTitle: event.title,
            requestedTicketCount: total,
            requestedTicketsByGrade: { ...tickets },
            deductedTicketCount: total,
            deductedTicketsByGrade: { ...tickets },
            status: 'ACCEPTED',
            requestedAt: now,
            acceptedAt: now,
            rejectionCode: null,
            rejectionReason: null,
        };
        // 내 응모 내역에도 남겨야 응모 직후 목록에서 확인할 수 있다
        myEntriesFor(userId).unshift(responseBody);

        return remember(201, okBody(responseBody));
    }),
];
