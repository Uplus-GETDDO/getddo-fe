import { http } from 'msw';

import type { TicketGrade, TicketHistory, TicketOperationType } from '@entities/ticket';

import { ticketGradeSchema } from '@entities/ticket';
import { env } from '@shared/config/env';
import { kstNextMonthStart, toKst } from '@shared/utils/date';

import { mockNow } from '../now';
import { ok } from './response';

const api = (path: string) => `${env.apiBaseUrl}${path}`;

const DAY_MS = 24 * 60 * 60 * 1000;
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
const kstMonthStart = (date: Date) => {
    const k = new Date(date.getTime() + KST_OFFSET_MS);
    return new Date(Date.UTC(k.getUTCFullYear(), k.getUTCMonth(), 1) - KST_OFFSET_MS);
};
const kstDate = (iso: string) => toKst(iso).toISOString().slice(0, 10);

// spec — 응모권 한 장. status·expiresAt은 마지막 처리 직후의 값이다
interface MockTicket {
    id: string;
    grade: TicketGrade;
    status: 'AVAILABLE' | 'RETURNED' | 'SPENT' | 'EXPIRED';
    /** 지급분은 지급 KST월 다음 달 1일, 반환분은 반환 KST월 다다음 달 1일 00:00 KST에 만료 */
    expiresAt: string;
}

// 목업 세션 동안 유지되는 응모권 상태 — X-User-ID별로 분리한다.
// 한 사용자의 출석 보상·응모 차감이 다른 사용자의 보유·이력에 섞이지 않게 한다
interface TicketState {
    tickets: MockTicket[];
    history: TicketHistory[];
}

const stateByUser = new Map<string, TicketState>();

const userIdOf = (request: Request) => request.headers.get('X-User-ID') ?? 'anonymous';

const isUsable = (ticket: MockTicket, now: number) =>
    (ticket.status === 'AVAILABLE' || ticket.status === 'RETURNED') &&
    new Date(ticket.expiresAt).getTime() > now;

interface HistoryExtra {
    eventId?: string;
    eventEntryId?: string;
    missionId?: string;
    gameId?: string;
    attendanceDate?: string;
    originalUseHistoryId?: string;
    correctedHistoryId?: string;
}

// 이력 한 건은 응모권 한 장의 처리 한 번 — 수량·누계 필드 없이 처리 직후 상태·만료를 남긴다 (spec T02)
function pushHistory(
    state: TicketState,
    ticket: MockTicket,
    operationType: TicketOperationType,
    reason: string,
    createdAt: string,
    extra: HistoryExtra = {},
) {
    const history: TicketHistory = {
        id: crypto.randomUUID(),
        ticketId: ticket.id,
        operationType,
        grade: ticket.grade,
        status: ticket.status,
        expiresAt: ticket.expiresAt,
        reason,
        createdAt,
        eventId: extra.eventId ?? null,
        eventEntryId: extra.eventEntryId ?? null,
        missionId: extra.missionId ?? null,
        gameId: extra.gameId ?? null,
        attendanceDate: extra.attendanceDate ?? null,
        originalUseHistoryId: extra.originalUseHistoryId ?? null,
        correctedHistoryId: extra.correctedHistoryId ?? null,
    };
    state.history.push(history);
    return history;
}

// 시연용 초기 상태 — 사용 가능 10장(브론즈 7·실버 2·골드 1)에 지출 3·반환 2·만료 2의 이력을 맞춘다
const seedState = (): TicketState => {
    const now = mockNow();
    // 이번 달 지급분의 만료(다음 달 1일 00:00 KST)와 반환분의 만료(다다음 달 1일 00:00 KST)
    const grantExpiry = kstNextMonthStart(now).toISOString();
    const refundExpiry = kstNextMonthStart(kstNextMonthStart(now)).toISOString();
    // 지난달 지급분은 이번 달 1일 00:00 KST에 만료했다
    const expiredAt = kstMonthStart(now).toISOString();
    const daysAgo = (days: number) => new Date(now.getTime() - days * DAY_MS).toISOString();

    const state: TicketState = { tickets: [], history: [] };

    const seedTicket = (grade: TicketGrade, expiresAt: string): MockTicket => {
        const ticket: MockTicket = {
            id: crypto.randomUUID(),
            grade,
            status: 'AVAILABLE',
            expiresAt,
        };
        state.tickets.push(ticket);
        return ticket;
    };
    const grant = (
        grade: TicketGrade,
        reason: string,
        createdAt: string,
        extra: HistoryExtra = {},
    ) => {
        const ticket = seedTicket(grade, grantExpiry);
        pushHistory(state, ticket, 'GRANT', reason, createdAt, extra);
        return ticket;
    };
    const spend = (
        ticket: MockTicket,
        reason: string,
        createdAt: string,
        extra: HistoryExtra = {},
    ) => {
        ticket.status = 'SPENT';
        return pushHistory(state, ticket, 'USE', reason, createdAt, extra);
    };

    // 사용 가능한 지급분 — 만료는 다음 달 1일. 등급별 장수는 countByGrade로 내려간다
    for (const days of [25, 18, 11, 4]) {
        grant('BRONZE', '매일 출석체크 리워드', daysAgo(days), {
            attendanceDate: kstDate(daysAgo(days)),
        });
    }
    grant('BRONZE', '알림 수신 동의 설문 보상', daysAgo(9), { missionId: 'mission-survey-01' });
    grant('SILVER', '공룡 달리기 게임 보상', daysAgo(7), { gameId: 'game-dino' });
    grant('SILVER', '5G 브랜드 퀴즈 보상', daysAgo(6), { missionId: 'mission-quiz-01' });
    grant('GOLD', '룰렛 돌리기 게임 보상', daysAgo(2), { gameId: 'game-roulette' });

    // 지출분 — 한 응모에 여러 장을 쓰면 장마다 USE 이력이 생기고 같은 eventEntryId를 가진다
    const sharedEntryId = crypto.randomUUID();
    const spent1 = grant('BRONZE', '매일 출석체크 리워드', daysAgo(20));
    const spent2 = grant('BRONZE', '7일 연속 출석 보너스', daysAgo(15));
    const spent3 = grant('SILVER', '주간 미션 보상', daysAgo(13), {
        missionId: 'mission-weekly-01',
    });
    spend(spent1, '닌텐도 스위치 2 래플 응모', daysAgo(14), {
        eventId: 'evt-001',
        eventEntryId: sharedEntryId,
    });
    spend(spent2, '닌텐도 스위치 2 래플 응모', daysAgo(14), {
        eventId: 'evt-001',
        eventEntryId: sharedEntryId,
    });
    spend(spent3, '스타벅스 e카드 래플 응모', daysAgo(10), {
        eventId: 'evt-002',
        eventEntryId: crypto.randomUUID(),
    });

    // 반환분 — 지출된 같은 응모권이 사용 가능 상태로 돌아온다 (등급 보존, 만료는 반환 월 다다음 달 1일)
    const returned1 = grant('BRONZE', '매일 출석체크 리워드', daysAgo(30));
    const returned2 = grant('BRONZE', '매일 출석체크 리워드', daysAgo(28));
    const useOfReturned1 = spend(returned1, 'VVIP 데이터 쿠폰 래플 응모', daysAgo(22), {
        eventId: 'evt-003',
        eventEntryId: crypto.randomUUID(),
    });
    const useOfReturned2 = spend(returned2, 'VVIP 데이터 쿠폰 래플 응모', daysAgo(22), {
        eventId: 'evt-003',
        eventEntryId: crypto.randomUUID(),
    });
    returned1.status = 'RETURNED';
    returned1.expiresAt = refundExpiry;
    pushHistory(state, returned1, 'REFUND', '이벤트 취소 응모권 반환', daysAgo(8), {
        eventId: 'evt-003',
        originalUseHistoryId: useOfReturned1.id,
    });
    returned2.status = 'RETURNED';
    returned2.expiresAt = refundExpiry;
    pushHistory(state, returned2, 'REFUND', '이벤트 취소 응모권 반환', daysAgo(8), {
        eventId: 'evt-003',
        originalUseHistoryId: useOfReturned2.id,
    });

    // 만료분 — 지난달 지급 응모권이 이 달 월 경계에 만료한 뒤 상태·이력이 일치해야 한다
    for (const reason of ['매일 출석체크 리워드', '매일 출석체크 리워드']) {
        const ticket = seedTicket('BRONZE', expiredAt);
        pushHistory(state, ticket, 'GRANT', reason, daysAgo(45));
        ticket.status = 'EXPIRED';
        pushHistory(state, ticket, 'EXPIRE', '응모권 월 만료', expiredAt);
    }

    return state;
};

const stateFor = (userId: string): TicketState => {
    let state = stateByUser.get(userId);
    if (!state) {
        state = seedState();
        stateByUser.set(userId, state);
    }
    return state;
};

// 자동 만료 처리가 지연돼도 만료된 응모권을 사용 가능으로 두지 않는다 —
// 조회·처리마다 기한이 지난 장을 EXPIRED로 돌리고 이력을 남겨 이력↔현재 상태를 일치시킨다
function syncExpired(state: TicketState) {
    const now = mockNow().getTime();
    for (const ticket of state.tickets) {
        if (
            (ticket.status === 'AVAILABLE' || ticket.status === 'RETURNED') &&
            new Date(ticket.expiresAt).getTime() <= now
        ) {
            ticket.status = 'EXPIRED';
            pushHistory(state, ticket, 'EXPIRE', '응모권 월 만료', ticket.expiresAt);
        }
    }
}

/** 게임·미션 보상의 등급 추첨 — 보상 건마다 확률로 등급 하나를 결정한다 (브론즈 79.98%·실버 18%·골드 2%·플래티넘 0.02%) */
export function drawMockTicketGrade(): TicketGrade {
    const roll = Math.random();
    if (roll < 0.7998) return 'BRONZE';
    if (roll < 0.9798) return 'SILVER';
    if (roll < 0.9998) return 'GOLD';
    return 'PLATINUM';
}

/** 응모 목업이 차감 전에 보유량을 확인할 때 쓴다 — 사용 가능(AVAILABLE·RETURNED, 미만료) 장수 */
export function getMockAvailableTicketCount(userId: string) {
    const state = stateFor(userId);
    syncExpired(state);
    return state.tickets.filter((ticket) => isUsable(ticket, mockNow().getTime())).length;
}

/** 등급별 보유량 — 미적용 이벤트의 브론즈 판정·등급별 부족(TICKET-006) 검증에 쓴다 */
export function getMockAvailableTicketCountByGrade(userId: string): Record<TicketGrade, number> {
    const state = stateFor(userId);
    syncExpired(state);
    const now = mockNow().getTime();
    const counts: Record<TicketGrade, number> = { BRONZE: 0, SILVER: 0, GOLD: 0, PLATINUM: 0 };
    for (const ticket of state.tickets) {
        if (isUsable(ticket, now)) counts[ticket.grade] += 1;
    }
    return counts;
}

interface GrantOptions extends HistoryExtra {
    grade: TicketGrade;
    /** 기본은 지급 KST월 다음 달 1일 00:00 KST — 보상 영수증이 정한 만료를 그대로 쓸 때 넘긴다 */
    expiresAt?: string;
}

/** 다른 목업 핸들러(출석·게임·미션 등)에서 응모권 지급을 기록할 때 쓴다 — 장당 지급 이력이 생긴다 */
export function recordMockTicketGrant(
    userId: string,
    count: number,
    reason: string,
    options: GrantOptions,
) {
    const state = stateFor(userId);
    const expiresAt = options.expiresAt ?? kstNextMonthStart(mockNow()).toISOString();
    const nowIso = mockNow().toISOString();
    for (let i = 0; i < count; i += 1) {
        const ticket: MockTicket = {
            id: crypto.randomUUID(),
            grade: options.grade,
            status: 'AVAILABLE',
            expiresAt,
        };
        state.tickets.push(ticket);
        pushHistory(state, ticket, 'GRANT', reason, nowIso, options);
    }
}

/**
 * 응모 차감을 기록할 때 쓴다 — 요청한 등급별 장수만큼 각 등급에서 만료가 이른 장부터 꺼내
 * SPENT로 두고 장당 USE 이력을 남긴다 (spec 02-domain/ticket.md — 같은 등급 안에서는 만료 임박순).
 * 보유량 검증은 호출부(응모 핸들러)가 먼저 한다
 */
export function recordMockTicketUse(
    userId: string,
    tickets: Partial<Record<TicketGrade, number>>,
    reason: string,
    options: HistoryExtra = {},
) {
    const state = stateFor(userId);
    syncExpired(state);
    const nowIso = mockNow().toISOString();
    const now = mockNow().getTime();
    for (const grade of ticketGradeSchema.options) {
        const count = tickets[grade] ?? 0;
        if (count <= 0) continue;
        const usable = state.tickets
            .filter((ticket) => ticket.grade === grade && isUsable(ticket, now))
            .sort((a, b) => a.expiresAt.localeCompare(b.expiresAt));
        for (const ticket of usable.slice(0, count)) {
            ticket.status = 'SPENT';
            pushHistory(state, ticket, 'USE', reason, nowIso, options);
        }
    }
}

/**
 * 이벤트 취소 등으로 차감된 응모권을 되돌릴 때 쓴다 — 같은 이벤트의 지출 장을 우선 찾아
 * 등급 그대로 RETURNED로 돌리고 원본 USE에 연결된 반환 이력을 남긴다.
 * 실제 지출 장이 모자라면(시드 응모 등) 새 장을 반환 상태로 발행해 합계를 맞춘다
 */
export function recordMockTicketRefund(
    userId: string,
    count: number,
    reason: string,
    options: Pick<HistoryExtra, 'eventId'> = {},
) {
    const state = stateFor(userId);
    syncExpired(state);
    const nowIso = mockNow().toISOString();
    // 반환분 만료 = 반환 KST월의 다다음 달 1일 00:00 KST (getddo-spec 02-domain/ticket.md)
    const expiresAt = kstNextMonthStart(kstNextMonthStart(mockNow())).toISOString();

    const useHistories = state.history.filter(
        (item) =>
            item.operationType === 'USE' && (!options.eventId || item.eventId === options.eventId),
    );
    let remaining = count;
    for (const use of useHistories) {
        if (remaining <= 0) break;
        const ticket = state.tickets.find((t) => t.id === use.ticketId);
        // 동일 차감 건의 반복 반환은 중복 반영하지 않는다
        if (!ticket || ticket.status !== 'SPENT') continue;
        ticket.status = 'RETURNED';
        ticket.expiresAt = expiresAt;
        pushHistory(state, ticket, 'REFUND', reason, nowIso, {
            eventId: use.eventId ?? options.eventId,
            originalUseHistoryId: use.id,
        });
        remaining -= 1;
    }
    for (; remaining > 0; remaining -= 1) {
        const ticket: MockTicket = {
            id: crypto.randomUUID(),
            grade: 'BRONZE',
            status: 'RETURNED',
            expiresAt,
        };
        state.tickets.push(ticket);
        pushHistory(state, ticket, 'REFUND', reason, nowIso, { eventId: options.eventId });
    }
}

export const ticketHandlers = [
    // T01 — MyTickets{availableCount, countByGrade, holdings, serverTime}
    http.get(api('/v1/tickets/me'), ({ request }) => {
        const state = stateFor(userIdOf(request));
        syncExpired(state);
        const now = mockNow().getTime();

        const countByGrade: Record<TicketGrade, number> = {
            BRONZE: 0,
            SILVER: 0,
            GOLD: 0,
            PLATINUM: 0,
        };
        const holdingByKey = new Map<
            string,
            { grade: TicketGrade; expiresAt: string; count: number }
        >();
        let availableCount = 0;
        for (const ticket of state.tickets) {
            if (!isUsable(ticket, now)) continue;
            availableCount += 1;
            countByGrade[ticket.grade] += 1;
            const key = `${ticket.grade}|${ticket.expiresAt}`;
            const holding = holdingByKey.get(key) ?? {
                grade: ticket.grade,
                expiresAt: ticket.expiresAt,
                count: 0,
            };
            holding.count += 1;
            holdingByKey.set(key, holding);
        }
        // 보유 묶음은 만료 임박순이다 (spec T01)
        const holdings = [...holdingByKey.values()].sort((a, b) =>
            a.expiresAt.localeCompare(b.expiresAt),
        );

        return ok({
            availableCount,
            countByGrade,
            holdings,
            serverTime: mockNow().toISOString(),
        });
    }),
    // T02 — Cursor<TicketHistory>. createdAt DESC, id DESC 순서의 커서 페이지다
    http.get(api('/v1/tickets/histories/me'), ({ request }) => {
        const state = stateFor(userIdOf(request));
        syncExpired(state);
        const url = new URL(request.url);
        const size = Math.min(100, Math.max(1, Number(url.searchParams.get('size')) || 20));
        const cursor = url.searchParams.get('cursor');
        const operationType = url.searchParams.get('operationType');
        const from = url.searchParams.get('from');
        const to = url.searchParams.get('to');

        const filtered = [...state.history]
            .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id))
            .filter((item) => {
                if (operationType && item.operationType !== operationType) return false;
                if (from && item.createdAt < from) return false;
                if (to && item.createdAt >= to) return false;
                return true;
            });
        const start = cursor ? filtered.findIndex((item) => item.id === cursor) + 1 : 0;
        const items = filtered.slice(start, start + size);
        return ok({
            items,
            nextCursor:
                items.length > 0 && start + size < filtered.length
                    ? (items.at(-1)?.id ?? null)
                    : null,
            totalElements: filtered.length,
        });
    }),
];
