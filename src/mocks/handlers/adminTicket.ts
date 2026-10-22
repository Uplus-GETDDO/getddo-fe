import { http } from 'msw';

import type {
    AdminTicketHistory,
    TicketGrade,
    TicketGrant,
    TicketInconsistency,
    TicketMismatch,
    TicketOperationType,
    TicketRefund,
    TicketSourceType,
    TicketStatus,
} from '@entities/ticket';

import { adminTicketHistorySchema } from '@entities/ticket';
import { env } from '@shared/config/env';
import { recentKstDays } from '@shared/utils/date';

import { mockNow } from '../now';
import { fail, ok } from './response';

/*
 * 관리자 응모권 조회 목업 — AO03·AO04·AO05·AO08·AO09 (2026-10-12 백엔드 답변 기준, 스펙 미반영).
 * 사용자 세션의 응모권 상태(ticket.ts)와 분리된 관리자 전용 고정 데이터셋이다.
 * 정합성은 응모권의 현재 버전·상태와 마지막 이력의 버전·상태를 비교해 데이터에서 계산한다 — 상수가 아니다.
 */
const api = (path: string) => `${env.apiBaseUrl}${path}`;

interface AdminMockTicket {
    id: string;
    userId: string;
    grade: TicketGrade;
    version: number;
    status: TicketStatus;
    expiresAt: string;
}

interface AdminMockHistory extends AdminTicketHistory {
    version: number;
    sourceType?: TicketSourceType;
    sourceId?: string;
}

export const MOCK_ADMIN_USERS = [
    { id: 'vu-doyoon', name: '김도윤' },
    { id: 'vu-seoyeon', name: '박서연' },
    { id: 'vu-haneul', name: '이하늘' },
    { id: 'vu-minjun', name: '최민준' },
    { id: 'vu-jiwoo', name: '정지우' },
    { id: 'vu-yuna', name: '한유나' },
] as const;

const MISSIONS = {
    'ms-quiz': '10월 상식 퀴즈',
    'ms-survey': '만족도 설문',
} as const;

export const adminTicketStore = {
    tickets: [] as AdminMockTicket[],
    histories: [] as AdminMockHistory[],
    refunds: [] as TicketRefund[],
};

// 이력 흐름 기호: G 지급, U 사용, R 반환, E 만료 — 흐름 순서대로 버전 1, 2, 3…이 된다
type Flow = 'G' | 'GU' | 'GUR' | 'GE' | 'GURU';
interface TicketSeed {
    user: number;
    grade: TicketGrade;
    source: TicketSourceType;
    missionId?: keyof typeof MISSIONS;
    flow: Flow;
    // 응모권의 현재 값을 마지막 이력과 다르게 만들어 불일치를 시드한다
    drift?: { version?: number; status?: TicketStatus };
}

const SEEDS: TicketSeed[] = [
    { user: 0, grade: 'BRONZE', source: 'ATTENDANCE', flow: 'G' },
    { user: 0, grade: 'BRONZE', source: 'ATTENDANCE', flow: 'GU' },
    { user: 0, grade: 'SILVER', source: 'MISSION', missionId: 'ms-quiz', flow: 'GUR' },
    { user: 1, grade: 'GOLD', source: 'GAME', flow: 'G' },
    { user: 1, grade: 'BRONZE', source: 'ATTENDANCE', flow: 'GU' },
    { user: 1, grade: 'SILVER', source: 'MISSION', missionId: 'ms-survey', flow: 'G' },
    { user: 2, grade: 'BRONZE', source: 'GAME', flow: 'GU', drift: { status: 'AVAILABLE' } },
    { user: 2, grade: 'BRONZE', source: 'ATTENDANCE', flow: 'G' },
    { user: 2, grade: 'GOLD', source: 'MISSION', missionId: 'ms-quiz', flow: 'GE' },
    { user: 3, grade: 'BRONZE', source: 'ATTENDANCE', flow: 'GU', drift: { version: 5 } },
    { user: 3, grade: 'SILVER', source: 'GAME', flow: 'GURU' },
    { user: 4, grade: 'BRONZE', source: 'ATTENDANCE', flow: 'G' },
    {
        user: 4,
        grade: 'BRONZE',
        source: 'ATTENDANCE',
        flow: 'GUR',
        drift: { version: 2, status: 'SPENT' },
    },
    { user: 5, grade: 'SILVER', source: 'MISSION', missionId: 'ms-survey', flow: 'GU' },
    { user: 5, grade: 'BRONZE', source: 'GAME', flow: 'G' },
];

const FLOW_STEPS: Record<Flow, { op: TicketOperationType; status: TicketStatus }[]> = {
    G: [{ op: 'GRANT', status: 'AVAILABLE' }],
    GU: [
        { op: 'GRANT', status: 'AVAILABLE' },
        { op: 'USE', status: 'SPENT' },
    ],
    GUR: [
        { op: 'GRANT', status: 'AVAILABLE' },
        { op: 'USE', status: 'SPENT' },
        { op: 'REFUND', status: 'RETURNED' },
    ],
    GE: [
        { op: 'GRANT', status: 'AVAILABLE' },
        { op: 'EXPIRE', status: 'EXPIRED' },
    ],
    GURU: [
        { op: 'GRANT', status: 'AVAILABLE' },
        { op: 'USE', status: 'SPENT' },
        { op: 'REFUND', status: 'RETURNED' },
        { op: 'USE', status: 'SPENT' },
    ],
};

const GRANT_EXPIRES_AT = '2026-10-31T15:00:00.000Z';
const REFUND_EXPIRES_AT = '2026-11-30T15:00:00.000Z';
const BASE_TIME = Date.parse('2026-10-01T00:00:00Z');
const STEP_MS = 60 * 60 * 1000;

const EVENTS = [
    { id: 'evt-201', title: '닌텐도 스위치 2 래플' },
    { id: 'evt-187', title: '스타벅스 e카드 래플' },
];

function seedStore() {
    const { tickets, histories, refunds } = adminTicketStore;
    tickets.length = 0;
    histories.length = 0;
    refunds.length = 0;

    SEEDS.forEach((seed, index) => {
        const user = MOCK_ADMIN_USERS[seed.user];
        const ticketId = `tk-${String(index + 1).padStart(3, '0')}`;
        const event = EVENTS[index % EVENTS.length];
        const steps = FLOW_STEPS[seed.flow];
        const last = steps[steps.length - 1];
        // 시드 정의가 항상 채워 두므로 비어 있으면 건너뛴다 (noUncheckedIndexedAccess 대응)
        if (!user || !event || !last) return;
        let useHistoryId: string | undefined;

        steps.forEach((step, stepIndex) => {
            const version = stepIndex + 1;
            const historyId = `${ticketId}-h${version}`;
            const createdAt = new Date(BASE_TIME + (index * 6 + stepIndex) * STEP_MS).toISOString();
            const isGrant = step.op === 'GRANT';
            const touchesEvent = step.op === 'USE' || step.op === 'REFUND';
            if (step.op === 'USE') useHistoryId = historyId;

            histories.push({
                id: historyId,
                ticketId,
                userId: user.id,
                userName: user.name,
                operationType: step.op,
                grade: seed.grade,
                status: step.status,
                expiresAt: step.op === 'REFUND' ? REFUND_EXPIRES_AT : GRANT_EXPIRES_AT,
                reason: isGrant ? `${seed.source} 지급` : step.op,
                createdAt,
                version,
                eventId: touchesEvent ? event.id : null,
                eventTitle: touchesEvent ? event.title : null,
                missionId: isGrant ? (seed.missionId ?? null) : null,
                missionTitle: isGrant && seed.missionId ? MISSIONS[seed.missionId] : null,
                originalUseHistoryId: step.op === 'REFUND' ? useHistoryId : null,
                ...(isGrant && { sourceType: seed.source, sourceId: `src-${ticketId}` }),
            });

            // 반환 이력은 이벤트 취소 반환으로 간주해 AO08 샘플로 노출한다
            if (step.op === 'REFUND') {
                refunds.push({
                    id: historyId,
                    spendHistoryId: useHistoryId ?? historyId,
                    ticketId,
                    grade: seed.grade,
                    eventId: event.id,
                    eventTitle: event.title,
                    userId: user.id,
                    userName: user.name,
                    reasonType: 'EVENT_CANCELED',
                    refundedAt: createdAt,
                    targetExpiresAt: REFUND_EXPIRES_AT,
                });
            }
        });

        tickets.push({
            id: ticketId,
            userId: user.id,
            grade: seed.grade,
            version: seed.drift?.version ?? steps.length,
            status: seed.drift?.status ?? last.status,
            expiresAt: last.op === 'REFUND' ? REFUND_EXPIRES_AT : GRANT_EXPIRES_AT,
        });
    });
}

// 대시보드 추이용 일별 지급 — 위 고정 시드(10/1~10/4) 뒤로 최근 14일에 날마다 출석·미션·게임 지급을 깐다.
// 날짜로 정한 난수라 같은 날은 늘 같은 값이다. 불일치·반환은 만들지 않아 정합성 시드에 영향이 없다
const TREND_DAYS = 14;
const TREND_START = BASE_TIME + 4 * 24 * STEP_MS;
const TREND_DAILY: Record<TicketSourceType, [min: number, max: number]> = {
    ATTENDANCE: [9, 16],
    MISSION: [3, 8],
    GAME: [4, 10],
};
// 출석은 브론즈만(ADR-016), 미션·게임은 등급 추첨 확률(TICKET_GRADE_ODDS 80 : 18 : 2)대로
const trendGrade = (source: TicketSourceType, r: number): TicketGrade =>
    source === 'ATTENDANCE' || r < 0.7998
        ? 'BRONZE'
        : r < 0.9798
          ? 'SILVER'
          : r < 0.9998
            ? 'GOLD'
            : 'PLATINUM';

function dayRandom(ymd: string) {
    let x = Number(ymd.replaceAll('-', '')) >>> 0 || 1;
    return () => {
        x ^= x << 13;
        x ^= x >>> 17;
        x ^= x << 5;
        return (x >>> 0) / 2 ** 32;
    };
}

function seedTrend() {
    const { tickets, histories } = adminTicketStore;
    const now = mockNow().getTime();
    let serial = 0;
    for (const day of recentKstDays(mockNow(), TREND_DAYS)) {
        if (Date.parse(day.from) < TREND_START) continue;
        const random = dayRandom(day.ymd);
        for (const source of Object.keys(TREND_DAILY) as TicketSourceType[]) {
            const [min, max] = TREND_DAILY[source];
            const count = min + Math.floor(random() * (max - min + 1));
            for (let n = 0; n < count; n += 1) {
                // 09~22시(KST) 사이에 흩어 지급하고, 아직 오지 않은 시각은 만들지 않는다
                const grantedAt = Date.parse(day.from) + (9 + random() * 13) * STEP_MS;
                const grade = trendGrade(source, random());
                // 절반쯤은 2시간 뒤 이벤트 응모에 쓴다 — 응모 추이 선의 재료
                const usedAt = random() < 0.5 ? grantedAt + 2 * STEP_MS : null;
                if (grantedAt > now) continue;
                serial += 1;
                const user = MOCK_ADMIN_USERS[serial % MOCK_ADMIN_USERS.length];
                const event = EVENTS[serial % EVENTS.length];
                if (!user || !event) continue;
                const ticketId = `tk-t${String(serial).padStart(4, '0')}`;
                const missionId: keyof typeof MISSIONS | null =
                    source === 'MISSION' ? (serial % 2 ? 'ms-quiz' : 'ms-survey') : null;
                const used = usedAt !== null && usedAt <= now;
                const base = {
                    ticketId,
                    userId: user.id,
                    userName: user.name,
                    grade,
                    expiresAt: GRANT_EXPIRES_AT,
                    originalUseHistoryId: null,
                };
                histories.push({
                    ...base,
                    id: `${ticketId}-h1`,
                    operationType: 'GRANT',
                    status: 'AVAILABLE',
                    reason: `${source} 지급`,
                    createdAt: new Date(grantedAt).toISOString(),
                    version: 1,
                    eventId: null,
                    eventTitle: null,
                    missionId,
                    missionTitle: missionId ? MISSIONS[missionId] : null,
                    sourceType: source,
                    sourceId: `src-${ticketId}`,
                });
                if (used) {
                    histories.push({
                        ...base,
                        id: `${ticketId}-h2`,
                        operationType: 'USE',
                        status: 'SPENT',
                        reason: 'USE',
                        createdAt: new Date(usedAt).toISOString(),
                        version: 2,
                        eventId: event.id,
                        eventTitle: event.title,
                        missionId: null,
                        missionTitle: null,
                    });
                }
                tickets.push({
                    id: ticketId,
                    userId: user.id,
                    grade,
                    version: used ? 2 : 1,
                    status: used ? 'SPENT' : 'AVAILABLE',
                    expiresAt: GRANT_EXPIRES_AT,
                });
            }
        }
    }
}

function seedAll() {
    seedStore();
    seedTrend();
}

seedAll();

// 목업 상태를 처음으로 되돌린다 — 테스트가 데이터를 바꾼 뒤 정리할 때 쓴다
export const resetAdminTicketStore = seedAll;

const userName = (userId: string) => MOCK_ADMIN_USERS.find((u) => u.id === userId)?.name ?? userId;

type Mismatch = TicketMismatch & { userId: string; grade: TicketGrade };

/** 응모권의 현재 버전·상태가 마지막 이력의 버전·상태와 다르면 불일치다 (spec AO04). */
export function findTicketMismatches(
    tickets: AdminMockTicket[],
    histories: AdminMockHistory[],
): Mismatch[] {
    const latestByTicket = new Map<string, AdminMockHistory>();
    for (const history of histories) {
        const current = latestByTicket.get(history.ticketId);
        if (!current || history.version > current.version) {
            latestByTicket.set(history.ticketId, history);
        }
    }
    const mismatches: Mismatch[] = [];
    for (const ticket of tickets) {
        const latest = latestByTicket.get(ticket.id);
        // 목업 시드에는 이력이 없는 응모권이 없다 — 비교할 마지막 이력이 없으면 건너뛴다
        if (!latest) continue;
        if (ticket.version === latest.version && ticket.status === latest.status) continue;
        mismatches.push({
            ticketId: ticket.id,
            userId: ticket.userId,
            grade: ticket.grade,
            ticketVersion: ticket.version,
            latestHistoryVersion: latest.version,
            ticketStatus: ticket.status,
            latestHistoryStatus: latest.status,
        });
    }
    return mismatches;
}

const badQuery = () => fail(400, 'TICKET-004', '조회 조건이 올바르지 않습니다.');
// 코드 번호는 백엔드가 구현 때 알리기로 했다 — 이 문자열에 의존하는 로직을 만들지 않는다
const userNotFound = () => fail(404, 'TICKET-404', '해당 사용자를 찾을 수 없습니다.');
const TZ_SUFFIX = /(Z|[+-]\d{2}:?\d{2})$/;

interface Range {
    from: string | null;
    to: string | null;
}

// 기간은 시간대를 포함해야 하고 [from, to)라서 둘 다 있으면 from < to여야 한다
function parseRange(params: URLSearchParams): Range | null {
    const from = params.get('from');
    const to = params.get('to');
    for (const value of [from, to]) {
        if (value !== null && (!TZ_SUFFIX.test(value) || Number.isNaN(Date.parse(value)))) {
            return null;
        }
    }
    if (from && to && Date.parse(from) >= Date.parse(to)) return null;
    return { from, to };
}

const inRange = (iso: string, { from, to }: Range) =>
    (!from || Date.parse(iso) >= Date.parse(from)) && (!to || Date.parse(iso) < Date.parse(to));

// 페이지는 1부터, size는 1~100(기본 20)이다. 정렬은 호출 쪽에서 끝낸다
function paginate<T>(rows: T[], params: URLSearchParams) {
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

// createdAt DESC, id DESC
const newestFirst =
    <T extends { id: string }>(timeOf: (row: T) => string) =>
    (a: T, b: T) =>
        timeOf(b).localeCompare(timeOf(a)) || b.id.localeCompare(a.id);

export const adminTicketHandlers = [
    // AO03 — 지급 이력. missionId를 쓰면 MISSION 행만 반환한다
    http.get(api('/v1/admin/ticket-grants'), ({ request }) => {
        const params = new URL(request.url).searchParams;
        const range = parseRange(params);
        if (!range) return badQuery();
        const userId = params.get('userId');
        const keyword = params.get('keyword')?.trim().toLowerCase();
        const missionId = params.get('missionId');
        const sourceType = params.get('sourceType');
        const grade = params.get('grade');

        const rows = adminTicketStore.histories
            .filter((h) => h.operationType === 'GRANT' && h.sourceType)
            .map((h) => ({
                id: h.id,
                grant: {
                    historyId: h.id,
                    ticketId: h.ticketId,
                    userId: h.userId,
                    userName: h.userName,
                    grade: h.grade,
                    sourceType: h.sourceType as TicketSourceType,
                    sourceId: h.sourceId ?? h.id,
                    missionId: h.missionId ?? null,
                    grantedAt: h.createdAt,
                    expiresAt: h.expiresAt,
                } satisfies TicketGrant,
            }))
            .filter(({ grant: g }) => {
                if (userId && g.userId !== userId) return false;
                if (keyword && !g.userName.toLowerCase().includes(keyword)) return false;
                if (missionId && (g.sourceType !== 'MISSION' || g.missionId !== missionId)) {
                    return false;
                }
                if (sourceType && g.sourceType !== sourceType) return false;
                if (grade && g.grade !== grade) return false;
                return inRange(g.grantedAt, range);
            })
            .sort(newestFirst((row) => row.grant.grantedAt))
            .map(({ grant }) => grant);
        const result = paginate(rows, params);
        return result ? ok(result) : badQuery();
    }),

    // AO04 — 사용자별 정합성. 없는 사용자는 404
    http.get(api('/v1/admin/users/:userId/tickets/consistency'), ({ params }) => {
        const userId = String(params.userId);
        if (!MOCK_ADMIN_USERS.some((u) => u.id === userId)) return userNotFound();
        const now = mockNow();
        const userTickets = adminTicketStore.tickets.filter((t) => t.userId === userId);
        const inconsistencies = findTicketMismatches(userTickets, adminTicketStore.histories).map(
            ({
                ticketId,
                ticketVersion,
                latestHistoryVersion,
                ticketStatus,
                latestHistoryStatus,
            }) => ({
                ticketId,
                ticketVersion,
                latestHistoryVersion,
                ticketStatus,
                latestHistoryStatus,
            }),
        );
        return ok({
            userId,
            userName: userName(userId),
            availableCount: userTickets.filter(
                (t) =>
                    (t.status === 'AVAILABLE' || t.status === 'RETURNED') &&
                    Date.parse(t.expiresAt) > now.getTime(),
            ).length,
            isConsistent: inconsistencies.length === 0,
            inconsistencies,
            checkedAt: now.toISOString(),
        });
    }),

    // AO09 — 전체 불일치 목록. 불일치한 응모권만 담고 요청마다 계산한다
    http.get(api('/v1/admin/tickets/inconsistencies'), ({ request }) => {
        const params = new URL(request.url).searchParams;
        const userId = params.get('userId');
        const checkedAt = mockNow().toISOString();
        const rows: TicketInconsistency[] = findTicketMismatches(
            adminTicketStore.tickets,
            adminTicketStore.histories,
        )
            .filter((m) => !userId || m.userId === userId)
            .map((m) => ({ ...m, userName: userName(m.userId), checkedAt }))
            .sort((a, b) => a.ticketId.localeCompare(b.ticketId));
        const result = paginate(rows, params);
        return result ? ok(result) : badQuery();
    }),

    // AO05 — 전체 이력
    http.get(api('/v1/admin/ticket-histories'), ({ request }) => {
        const params = new URL(request.url).searchParams;
        const range = parseRange(params);
        if (!range) return badQuery();
        const userId = params.get('userId');
        const eventId = params.get('eventId');
        const missionId = params.get('missionId');
        const operationType = params.get('operationType');

        const rows: AdminTicketHistory[] = adminTicketStore.histories
            .filter((h) => {
                if (userId && h.userId !== userId) return false;
                if (eventId && h.eventId !== eventId) return false;
                if (missionId && h.missionId !== missionId) return false;
                if (operationType && h.operationType !== operationType) return false;
                return inRange(h.createdAt, range);
            })
            .sort(newestFirst((h) => h.createdAt))
            // 내부 필드(version·출처)는 스키마가 걸러 낸다
            .map((h) => adminTicketHistorySchema.parse(h));
        const result = paginate(rows, params);
        return result ? ok(result) : badQuery();
    }),

    // AO08 — 반환 이력. 실서버는 이벤트 취소→반환 연결 전까지 빈 목록이지만 목업은 데모용 샘플을 둔다
    http.get(api('/v1/admin/ticket-refunds'), ({ request }) => {
        const params = new URL(request.url).searchParams;
        const range = parseRange(params);
        if (!range) return badQuery();
        const userId = params.get('userId');
        const eventId = params.get('eventId');

        const rows = adminTicketStore.refunds
            .filter(
                (r) =>
                    (!userId || r.userId === userId) &&
                    (!eventId || r.eventId === eventId) &&
                    inRange(r.refundedAt, range),
            )
            .sort(newestFirst((r) => r.refundedAt));
        const result = paginate(rows, params);
        return result ? ok(result) : badQuery();
    }),
];
