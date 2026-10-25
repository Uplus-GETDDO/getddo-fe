import { http } from 'msw';
import { z } from 'zod';

import type { AdminEventStatus, AdminPrize, MembershipRule } from '@entities/event';

import { env } from '@shared/config/env';

import { mockNow } from '../now';
import { getMockDrawOverview } from './draw';
import { mockEntryTicketTotals, mockEventHasEntries } from './entry';
import { entryRuleOf, mockEvents, sessionFixedTime } from './event';
import { fail, ok } from './response';
import { recordMockTicketRefund } from './ticket';

const api = (path: string) => `${env.apiBaseUrl}${path}`;

/**
 * 올린 이미지를 키로 기억한다 — 실서버의 S3 자리.
 *
 * 등록·수정은 키만 싣고 오므로, 화면에 보여 줄 주소는 이 표에서 되찾는다.
 * 새로고침하면 사라진다(목업은 메모리에만 둔다) — 그때는 키만 남아 회색 칸이 된다.
 */
const mockUploadedImages = new Map<string, string>();

/** 업로드 거절 문구 — 실서버가 EVENT-018로 보내는 문장 그대로다 */
const IMAGE_REJECTED_MESSAGE = '5MB 이하의 JPG·PNG 이미지 파일이 필요합니다.';

/** 등록·수정이 실어 온 키를 화면 주소로 바꾼다 — 모르는 키는 주소가 없다 */
export function resolveMockImageUrl(imageKey: string | null | undefined): string | null {
    return imageKey ? (mockUploadedImages.get(imageKey) ?? null) : null;
}

/**
 * multipart 본문에서 파일 한 덩이를 꺼낸다.
 *
 * request.formData()는 이 환경(undici)에서 예외를 던진다. 바이트를 그대로 보존하는 latin1로
 * 한 번 읽어 머리말 위치를 찾고, 같은 자리에서 원본 바이트를 잘라 낸다.
 */
function readMultipartFile(buffer: ArrayBuffer): { contentType: string; dataUrl: string } | null {
    const bytes = new Uint8Array(buffer);
    const text = new TextDecoder('latin1').decode(bytes);

    const header = /filename="[^"]*"[^]*?content-type:\s*([^\r\n]+)\r?\n\r?\n/i.exec(text);
    if (!header) return null;

    /*
     * 끝은 첫 줄에 통째로 적혀 온 경계 문자열로 찾는다. '\r\n--'만 보고 자르면 사진 바이트가
     * 우연히 그 네 바이트를 품었을 때 거기서 끊겨 반쪽 그림이 된다.
     */
    const boundary = /^(--[^\r\n]+)\r?\n/.exec(text)?.[1];
    const start = header.index + header[0].length;
    const end = boundary ? text.indexOf(`\r\n${boundary}`, start) : -1;
    const body = bytes.slice(start, end === -1 ? bytes.length : end);

    let binary = '';
    for (const byte of body) binary += String.fromCharCode(byte);
    const contentType = header[1]!.trim().toLowerCase();
    return { contentType, dataUrl: `data:${contentType};base64,${btoa(binary)}` };
}

/** ADR-026 — 최초 자동 추첨은 마감 + 1분부터 대상이 된다. 공개 예정 시각이 아니다 */
const DRAW_DELAY_MS = 60 * 1000;
const MINUTE = 60 * 1000;

/**
 * 관리자 목업의 이벤트 항목 — AdminEvent(spec AE01/AE02) + 내부 카운터.
 * entryCount·usedTicketTotal은 응답 DTO에 없고 취소 시 반환 수량 계산에만 쓴다.
 */
/**
 * 목업이 들고 있는 경품 — 응답의 prizes[]에는 imageKey가 없고 prizeImages로 따로 나간다.
 * 씨앗 데이터는 이미지가 없어 키를 적지 않으므로 선택 속성으로 둔다.
 */
interface MockAdminPrize extends AdminPrize {
    imageKey?: string | null;
}

interface MockAdminEvent {
    id: string;
    title: string;
    description: string;
    imageUrl: string | null;
    imageKey: string | null;
    eventType: 'NO_TICKET' | 'TICKET';
    weightingEnabled: boolean;
    maxTicketsPerUser: number | null;
    membershipRule: MembershipRule;
    startsAt: string;
    endsAt: string;
    /** 저장 상태 — SCHEDULED/OPEN/CLOSED는 응답 시각에 시간으로 재계산된다 */
    status: AdminEventStatus;
    prizes: MockAdminPrize[];
    createdAt: string;
    updatedAt: string;
    canceledAt: string | null;
    entryCount: number;
    usedTicketTotal: number;
}

/**
 * 사용자 목업(mockEvents)을 관리자 모양으로 1회 변환해 시드한다.
 * 사용자 Event는 필드가 달라(requiredTickets·prizeName…) spec 계약과 별개라,
 * 관리자에서 만든 변경은 사용자 목록에 projection으로 다시 싣는다(아래 upsertUserProjection).
 */
function toAdminSeed(e: (typeof mockEvents)[number]): MockAdminEvent {
    // 사용자·관리자 목업이 같은 응모 규칙을 보게 같은 파생 함수를 쓴다 (GD-150)
    const rule = entryRuleOf(e);
    return {
        id: e.id,
        title: e.title,
        description: e.description,
        imageUrl: e.bannerImageUrl,
        imageKey: null,
        eventType: rule.eventType,
        weightingEnabled: rule.weightingEnabled,
        maxTicketsPerUser: rule.maxTicketsPerUser,
        membershipRule: rule.membershipRule,
        startsAt: e.startsAt,
        endsAt: e.endsAt,
        status: 'SCHEDULED',
        prizes: [
            {
                id: `${e.id}-prize-1`,
                rank: 1,
                name: e.prizeName,
                description: null,
                imageUrl: null,
                winnerCount: e.winnerCount,
            },
        ],
        createdAt: e.startsAt,
        updatedAt: e.startsAt,
        canceledAt: null,
        entryCount: e.participantCount ?? 0,
        usedTicketTotal: e.usedTicketCount ?? 0,
    };
}

function adminSeed(
    over: Partial<MockAdminEvent> &
        Pick<MockAdminEvent, 'id' | 'title' | 'description' | 'status' | 'startsAt' | 'endsAt'>,
): MockAdminEvent {
    return {
        imageUrl: null,
        imageKey: null,
        eventType: 'TICKET',
        weightingEnabled: true,
        maxTicketsPerUser: 5,
        membershipRule: 'excellent',
        prizes: [],
        createdAt: over.startsAt,
        updatedAt: over.startsAt,
        canceledAt: null,
        entryCount: 0,
        usedTicketTotal: 0,
        ...over,
    };
}

// 관리자 전용 시드 — 시간만으로는 나오지 않는 운영 상태(취소·재추첨·대상 없음 종료)를 시연용으로 채운다
const extraSeeds: MockAdminEvent[] = [
    adminSeed({
        id: '20000000-0000-4000-8000-000000000902',
        title: '취소된 오픈 기념 이벤트',
        description: '경품 수급 문제로 취소된 이벤트.',
        startsAt: sessionFixedTime(
            '20000000-0000-4000-8000-000000000902-starts',
            -72 * 60 * MINUTE,
        ),
        endsAt: sessionFixedTime('20000000-0000-4000-8000-000000000902-ends', -24 * 60 * MINUTE),
        status: 'CANCELED',
        canceledAt: sessionFixedTime(
            '20000000-0000-4000-8000-000000000902-canceled',
            -36 * 60 * MINUTE,
        ),
        entryCount: 45,
        prizes: [
            {
                id: '20000000-0000-4000-8000-000000000902-p1',
                rank: 1,
                name: '스타벅스 e카드',
                description: null,
                imageUrl: null,
                winnerCount: 30,
            },
        ],
    }),
    adminSeed({
        id: '20000000-0000-4000-8000-000000000903',
        title: '응모자 없이 종료된 이벤트',
        description: '마감까지 응모가 없어 자동 종료된 이벤트.',
        startsAt: sessionFixedTime(
            '20000000-0000-4000-8000-000000000903-starts',
            -50 * 60 * MINUTE,
        ),
        endsAt: sessionFixedTime('20000000-0000-4000-8000-000000000903-ends', -26 * 60 * MINUTE),
        status: 'NO_ENTRANTS',
        prizes: [
            {
                id: '20000000-0000-4000-8000-000000000903-p1',
                rank: 1,
                name: '무너 스티커 팩',
                description: null,
                imageUrl: null,
                winnerCount: 10,
            },
        ],
    }),
    adminSeed({
        id: '20000000-0000-4000-8000-000000000904',
        title: '재추첨 진행 중인 래플',
        description: '당첨 취소에 따른 재추첨이 진행 중인 이벤트.',
        startsAt: sessionFixedTime(
            '20000000-0000-4000-8000-000000000904-starts',
            -80 * 60 * MINUTE,
        ),
        endsAt: sessionFixedTime('20000000-0000-4000-8000-000000000904-ends', -30 * 60 * MINUTE),
        status: 'REDRAWING',
        entryCount: 800,
        usedTicketTotal: 1600,
        prizes: [
            {
                id: '20000000-0000-4000-8000-000000000904-p1',
                rank: 1,
                name: '닌텐도 스위치 2',
                description: null,
                imageUrl: null,
                winnerCount: 1,
            },
        ],
    }),
    adminSeed({
        id: '20000000-0000-4000-8000-000000000905',
        title: '발표 대기 중인 이벤트',
        description: '추첨이 확정되고 공개 명단 갱신을 기다리는 이벤트.',
        startsAt: sessionFixedTime(
            '20000000-0000-4000-8000-000000000905-starts',
            -70 * 60 * MINUTE,
        ),
        endsAt: sessionFixedTime('20000000-0000-4000-8000-000000000905-ends', -20 * 60 * MINUTE),
        status: 'DRAW_CONFIRMED',
        entryCount: 540,
        usedTicketTotal: 1080,
        prizes: [
            {
                id: '20000000-0000-4000-8000-000000000905-p1',
                rank: 1,
                name: '에어팟 4',
                description: null,
                imageUrl: null,
                winnerCount: 3,
            },
        ],
    }),
];

const mockAdminEvents: MockAdminEvent[] = [...mockEvents.map(toAdminSeed), ...extraSeeds];

/**
 * 응답 시점의 운영 상태 — 서버가 시간·운영으로 바꾸는 값이라 저장값을 그대로 쓰지 않고 재계산한다.
 * 공개 여부는 시각이 아니라 당첨자 공개 요청의 성공으로 판정한다 (ADR-022) — 추첨 목업과 같은
 * 사실을 읽어 사용자 결과·공개 이력과 어긋나지 않게 한다.
 */
function effectiveStatus(item: MockAdminEvent, now: number): AdminEventStatus {
    const draw = getMockDrawOverview(item.id);
    if (draw.published) return 'PUBLISHED';

    if (item.status === 'SCHEDULED' || item.status === 'OPEN' || item.status === 'CLOSED') {
        const starts = new Date(item.startsAt).getTime();
        const ends = new Date(item.endsAt).getTime();
        if (now < starts) return 'SCHEDULED';
        if (now < ends) return 'OPEN';
        // 마감 뒤 추첨 실행 상태를 따른다 — 확정됐어도 공개 전이면 선정 완료(발표 대기)다
        if (draw.hasRunningReplacement) return 'REDRAWING';
        if (draw.hasConfirmedRun) return 'DRAW_CONFIRMED';
        return 'CLOSED';
    }
    return item.status;
}

/** 응답 직렬화 — 내부 카운터를 빼고 계산된 상태·서버 시각·자동 추첨 기준을 싣는다 */
function toAdminResponse(item: MockAdminEvent, now: number) {
    const rest: Partial<MockAdminEvent> = { ...item };
    delete rest.entryCount;
    delete rest.usedTicketTotal;
    return {
        ...rest,
        // 실서버와 같이 키는 prizes[]가 아니라 prizeImages로 나간다 (05-api/event.md AdminEvent)
        prizes: item.prizes.map(
            ({ id, rank, name, description, imageUrl, winnerCount }): AdminPrize => ({
                id,
                rank,
                name,
                description,
                imageUrl,
                winnerCount,
            }),
        ),
        prizeImages: item.prizes.map((prize) => ({
            prizeId: prize.id,
            imageKey: prize.imageKey ?? null,
        })),
        status: effectiveStatus(item, now),
        // 마감 + 1분의 최초 자동 추첨 기준 — 공개 예정 시각이 아니다 (ADR-026)
        drawScheduledAt: new Date(new Date(item.endsAt).getTime() + DRAW_DELAY_MS).toISOString(),
        serverTime: new Date(now).toISOString(),
    };
}

/* ── 사용자 목록 브리지 ───────────────────────────────────────────────
 * 관리자 변경이 사용자 /events 목록에도 보여야 시연 흐름이 이어진다.
 * 사용자 Event 모양으로 변환해 mockEvents에 upsert/제거한다. */

function toUserProjection(item: MockAdminEvent) {
    return {
        id: item.id,
        title: item.title,
        description: item.description,
        bannerImageUrl: item.imageUrl,
        detailImageUrl: null,
        startsAt: item.startsAt,
        endsAt: item.endsAt,
        // status는 응답에서 시간으로 재계산된다 — 저장값은 의미 없는 placeholder
        status: 'upcoming' as const,
        requiredTickets: item.eventType === 'TICKET' ? 1 : 0,
        // 응모 규칙 필드는 그대로 실어야 응모 목업이 유형별 규칙을 같은 값으로 판정한다
        eventType: item.eventType,
        weightingEnabled: item.weightingEnabled,
        maxTicketsPerUser: item.maxTicketsPerUser,
        membershipRule: item.membershipRule,
        prizeName:
            item.prizes.length > 1
                ? `${item.prizes[0]?.name ?? ''} 외 ${item.prizes.length - 1}종`
                : (item.prizes[0]?.name ?? ''),
        winnerCount: item.prizes.reduce((sum, p) => sum + p.winnerCount, 0),
        participantCount: item.entryCount,
        usedTicketCount: item.usedTicketTotal,
        myEntryCount: 0,
        myTicketCount: 0,
    };
}

function upsertUserProjection(item: MockAdminEvent) {
    const existing = mockEvents.find((e) => e.id === item.id);
    const projection = toUserProjection(item);
    if (existing) Object.assign(existing, projection);
    else mockEvents.push(projection);
}

function removeUserProjection(eventId: string) {
    const index = mockEvents.findIndex((e) => e.id === eventId);
    if (index >= 0) mockEvents.splice(index, 1);
}

/**
 * 취소 정리 — 실제 차감분을 각 사용자 잔액에 되돌리고 반환 이력을 남긴 뒤 사용자 목록 projection을 제거한다.
 * refundedTicketCount는 시드된 사용 총량과 실제 환불 합계 중 큰 값으로 보낸다
 * (시드 응모자는 목업에 실제 지갑이 없어 잔액 반영 없이 합계만 표시한다).
 */
function refundAndRelease(item: MockAdminEvent): number {
    let refunded = 0;
    for (const [userId, count] of mockEntryTicketTotals(item.id)) {
        recordMockTicketRefund(userId, count, `${item.title} 이벤트 취소 응모권 반환`, {
            eventId: item.id,
        });
        refunded += count;
    }
    const total = Math.max(item.usedTicketTotal, refunded);
    item.usedTicketTotal = 0;
    removeUserProjection(item.id);
    return total;
}

/* ── 요청 본문 검증 — spec EventWriteRequest 제약을 목업도 그대로 적용한다 ── */

interface EventWriteBody {
    title?: unknown;
    description?: unknown;
    imageKey?: unknown;
    eventType?: unknown;
    weightingEnabled?: unknown;
    maxTicketsPerUser?: unknown;
    membershipRule?: unknown;
    startsAt?: unknown;
    endsAt?: unknown;
    prizes?: unknown;
}

interface PrizeWriteBody {
    id?: unknown;
    rank?: unknown;
    name?: unknown;
    winnerCount?: unknown;
    description?: unknown;
    imageKey?: unknown;
}

const isNonBlank = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0;
const isInt = (v: unknown, min = 1): v is number =>
    typeof v === 'number' && Number.isInteger(v) && v >= min;
const isInstant = (v: unknown): v is string =>
    typeof v === 'string' && !Number.isNaN(new Date(v).getTime());

function validatePrize(prize: PrizeWriteBody): string | null {
    if (!isInt(prize.rank)) return '경품 등수는 1 이상의 정수여야 합니다';
    if (!isNonBlank(prize.name) || prize.name.length > 200) return '경품명은 1~200자입니다';
    if (!isInt(prize.winnerCount)) return '당첨 인원은 1 이상의 정수여야 합니다';
    return null;
}

function validateWriteBody(body: EventWriteBody): string | null {
    if (!isNonBlank(body.title) || body.title.length > 200) return '이벤트 이름은 1~200자입니다';
    if (!isNonBlank(body.description)) return '이벤트 설명을 입력해야 합니다';
    if (
        body.imageKey != null &&
        (typeof body.imageKey !== 'string' || body.imageKey.length > 500)
    ) {
        return 'imageKey는 500자 이하의 문자열이어야 합니다';
    }
    if (body.eventType !== 'NO_TICKET' && body.eventType !== 'TICKET') {
        return 'eventType은 NO_TICKET 또는 TICKET이어야 합니다';
    }
    if (typeof body.weightingEnabled !== 'boolean')
        return 'weightingEnabled는 boolean이어야 합니다';
    if (body.eventType === 'NO_TICKET') {
        if (body.weightingEnabled !== false)
            return '응모권 미사용 이벤트는 가중치를 적용할 수 없습니다';
        if (body.maxTicketsPerUser !== null)
            return '응모권 미사용 이벤트의 maxTicketsPerUser는 null입니다';
    } else if (body.weightingEnabled === false) {
        if (body.maxTicketsPerUser !== 1) return '가중치 미적용 이벤트는 사용자당 1장입니다';
    } else if (
        body.maxTicketsPerUser !== null &&
        (!isInt(body.maxTicketsPerUser) || body.maxTicketsPerUser > 5)
    ) {
        return 'maxTicketsPerUser는 1~5의 정수 또는 null(월말 소진용)입니다';
    }
    if (!['excellent', 'vip', 'vvip'].includes(body.membershipRule as string)) {
        return 'membershipRule은 excellent/vip/vvip 중 하나입니다';
    }
    if (!isInstant(body.startsAt) || !isInstant(body.endsAt)) {
        return '시작·종료 시각은 오프셋이 있는 시각이어야 합니다';
    }
    if (new Date(body.endsAt).getTime() <= new Date(body.startsAt).getTime()) {
        return '종료 시각은 시작 시각보다 뒤여야 합니다';
    }
    if (!Array.isArray(body.prizes) || body.prizes.length === 0) {
        return '경품은 1개 이상 등록해야 합니다';
    }
    const ranks = new Set<number>();
    for (const prize of body.prizes as PrizeWriteBody[]) {
        const error = validatePrize(prize);
        if (error) return error;
        if (ranks.has(prize.rank as number)) return '같은 등수의 경품을 중복 등록할 수 없습니다';
        ranks.add(prize.rank as number);
    }
    return null;
}

function writeBodyToItem(body: EventWriteBody, id: string, nowIso: string): MockAdminEvent {
    const prizes = (body.prizes as PrizeWriteBody[]).map((p) => ({
        id: typeof p.id === 'string' && p.id ? p.id : crypto.randomUUID(),
        rank: p.rank as number,
        name: (p.name as string).trim(),
        description: typeof p.description === 'string' && p.description ? p.description : null,
        imageUrl: resolveMockImageUrl(p.imageKey as string | null),
        imageKey: (p.imageKey as string | null) ?? null,
        winnerCount: p.winnerCount as number,
    }));
    return {
        id,
        title: (body.title as string).trim(),
        description: (body.description as string).trim(),
        imageUrl: resolveMockImageUrl(body.imageKey as string | null),
        imageKey: (body.imageKey as string | null) ?? null,
        eventType: body.eventType as MockAdminEvent['eventType'],
        weightingEnabled: body.weightingEnabled as boolean,
        maxTicketsPerUser: body.maxTicketsPerUser as number | null,
        membershipRule: body.membershipRule as MembershipRule,
        startsAt: new Date(body.startsAt as string).toISOString(),
        endsAt: new Date(body.endsAt as string).toISOString(),
        status: 'SCHEDULED',
        prizes,
        createdAt: nowIso,
        updatedAt: nowIso,
        canceledAt: null,
        entryCount: 0,
        usedTicketTotal: 0,
    };
}

const findItem = (eventId: unknown) => mockAdminEvents.find((e) => e.id === eventId);

const operationResult = (
    item: MockAdminEvent,
    previousStatus: AdminEventStatus,
    refunded: number,
    now: Date,
) => ({
    eventId: item.id,
    previousStatus,
    status: item.status,
    refundedTicketCount: refunded,
    processedAt: now.toISOString(),
});

const readReason = async (request: Request) => {
    const body = (await request.json().catch(() => null)) as { reason?: unknown } | null;
    return typeof body?.reason === 'string' ? body.reason.trim() : '';
};

/** 취소된 이벤트 신규 연결을 배너 목업에서 거절할 때 쓴다. */
export const mockAdminEventIsCanceled = (eventId: string): boolean =>
    mockAdminEvents.some((event) => event.id === eventId && event.status === 'CANCELED');

/** 목업 이벤트 존재 여부 — AO07 등 다른 관리자 목업의 404 판정에 쓴다 */
export const mockAdminEventExists = (eventId: string): boolean =>
    mockAdminEvents.some((event) => event.id === eventId);

export const adminEventHandlers = [
    // AE01 — 목록: keyword/status/eventType/from/to 필터 + Page<AdminEvent> 봉투 (페이지는 1부터)
    http.get(api('/v1/admin/events'), ({ request }) => {
        const url = new URL(request.url);
        const now = mockNow().getTime();
        const page = Math.max(1, Number(url.searchParams.get('page')) || 1);
        const size = Math.max(1, Number(url.searchParams.get('size')) || 20);
        const keyword = url.searchParams.get('keyword')?.trim().toLowerCase();
        const status = url.searchParams.get('status');
        const eventType = url.searchParams.get('eventType');
        const from = url.searchParams.get('from');
        const to = url.searchParams.get('to');
        const sort = url.searchParams.get('sort') ?? 'createdAt,desc';
        const sortMatch = /^(createdAt|startsAt|endsAt|title),(asc|desc)$/.exec(sort);
        const createdFrom = url.searchParams.get('createdFrom');
        const createdTo = url.searchParams.get('createdTo');
        if (
            !sortMatch ||
            [createdFrom, createdTo].some(
                (date) => date !== null && !z.iso.date().safeParse(date).success,
            ) ||
            (createdFrom !== null && createdTo !== null && createdFrom > createdTo)
        ) {
            return fail(400, 'EVENT-008', '검색 조건을 확인해 주세요.');
        }
        const sortField = sortMatch[1] as 'createdAt' | 'startsAt' | 'endsAt' | 'title';
        const direction = sortMatch[2] === 'asc' ? 1 : -1;
        const weightingEnabled = url.searchParams.get('weightingEnabled');
        const createdStart =
            createdFrom === null ? null : new Date(`${createdFrom}T00:00:00+09:00`).getTime();
        const createdEnd =
            createdTo === null
                ? null
                : new Date(`${createdTo}T00:00:00+09:00`).getTime() + 86_400_000;

        const filtered = mockAdminEvents
            .filter((item) => {
                if (status && effectiveStatus(item, now) !== status) return false;
                if (eventType && item.eventType !== eventType) return false;
                if (
                    keyword &&
                    !`${item.title} ${item.description}`.toLowerCase().includes(keyword)
                ) {
                    return false;
                }
                if (weightingEnabled === 'true' && !item.weightingEnabled) return false;
                if (weightingEnabled === 'false' && item.weightingEnabled) return false;
                const createdAt = new Date(item.createdAt).getTime();
                if (createdStart !== null && createdAt < createdStart) return false;
                if (createdEnd !== null && createdAt >= createdEnd) return false;
                // 기간 필터 [from, to)는 응모 시작 시각 기준으로 해석한다
                if (from && new Date(item.startsAt) < new Date(from)) return false;
                if (to && new Date(item.startsAt) >= new Date(to)) return false;
                return true;
            })
            .sort((a, b) => {
                const primary =
                    sortField === 'title'
                        ? a.title.localeCompare(b.title)
                        : new Date(a[sortField]).getTime() - new Date(b[sortField]).getTime();
                return direction * (primary || a.id.localeCompare(b.id));
            });

        return ok({
            items: filtered
                .slice((page - 1) * size, page * size)
                .map((item) => toAdminResponse(item, now)),
            page,
            size,
            totalElements: filtered.length,
        });
    }),

    // AE02 — 상세
    http.get(api('/v1/admin/events/:eventId'), ({ params }) => {
        const item = findItem(params.eventId);
        if (!item) return fail(404, 'RESOURCE_NOT_FOUND', '이벤트를 찾을 수 없습니다');
        return ok(toAdminResponse(item, mockNow().getTime()));
    }),

    /**
     * 이벤트·경품 이미지 업로드 (BE GD-227).
     *
     * 실서버는 S3에 올리고 키와 공개 주소를 돌려준다. 목업은 올린 바이트를 키에 묶어 기억해
     * 등록·수정 뒤에도 같은 그림이 보이게 한다. 형식·용량 기준은 서버와 같게 맞춘다.
     */
    http.post(api('/v1/admin/events/images'), async ({ request }) => {
        // 이 파일의 다른 관리자 핸들러와 같이 역할 검사는 두지 않는다 — 실서버가 판정한다
        const target = new URL(request.url).searchParams.get('target');
        if (target !== 'EVENT' && target !== 'PRIZE') {
            return fail(400, 'COMMON-002', 'target은 EVENT 또는 PRIZE여야 합니다');
        }

        const buffer = await request.arrayBuffer().catch(() => null);
        const file = buffer && readMultipartFile(buffer);
        if (!file) return fail(400, 'COMMON-002', '파일이 없습니다');

        // 실서버는 형식·용량 위반을 한 코드·한 문구로 묶어 돌려준다 (2026-10-21 실서버 확인)
        const png = file.contentType === 'image/png';
        if (!png && file.contentType !== 'image/jpeg') {
            return fail(400, 'EVENT-018', IMAGE_REJECTED_MESSAGE);
        }
        if (buffer.byteLength > 5_000_000) return fail(400, 'EVENT-018', IMAGE_REJECTED_MESSAGE);

        const directory = target === 'EVENT' ? 'events' : 'prizes';
        const key = `${directory}/${crypto.randomUUID()}.${png ? 'png' : 'jpg'}`;
        mockUploadedImages.set(key, file.dataUrl);
        return ok({ imageKey: key, imageUrl: file.dataUrl }, 201);
    }),

    // AE03 — 등록: 이벤트와 경품이 함께 성공하거나 함께 실패한다
    http.post(api('/v1/admin/events'), async ({ request }) => {
        const body = (await request.json().catch(() => null)) as EventWriteBody | null;
        if (!body) return fail(400, 'COMMON-002', '요청 본문이 올바르지 않습니다');
        const error = validateWriteBody(body);
        if (error) return fail(400, 'COMMON-002', error);

        const item = writeBodyToItem(body, crypto.randomUUID(), mockNow().toISOString());
        mockAdminEvents.unshift(item);
        upsertUserProjection(item);
        return ok(toAdminResponse(item, mockNow().getTime()), 201);
    }),

    // AE04 — 수정은 실서버로 전환됐다 (GD-188). 핸들러를 두지 않아 bypass로 실제 API에 닿는다

    // AE05 — 삭제: 시작 전이며 응모 이력이 없을 때만 가능하다
    http.delete(api('/v1/admin/events/:eventId'), ({ params }) => {
        const item = findItem(params.eventId);
        if (!item) return fail(404, 'RESOURCE_NOT_FOUND', '이벤트를 찾을 수 없습니다');
        if (effectiveStatus(item, mockNow().getTime()) !== 'SCHEDULED') {
            return fail(409, 'STATE_CONFLICT', '시작 전 이벤트만 삭제할 수 있습니다');
        }
        // 시드된 응모자 수(entryCount)와 실제 접수 이력을 모두 본다 — 시드만 있는 이벤트도 삭제를 막는다
        if (item.entryCount > 0 || mockEventHasEntries(item.id)) {
            return fail(409, 'STATE_CONFLICT', '응모 이력이 있는 이벤트는 삭제할 수 없습니다');
        }
        // 연결 배너는 관리자 목록에 보존하고 B01에서만 숨긴다.
        mockAdminEvents.splice(mockAdminEvents.indexOf(item), 1);
        removeUserProjection(item.id);
        return ok(null);
    }),

    // AE08 — 취소: 상태와 관계없이 허용. 취소와 대상 차감분 반환이 함께 완료되어야 성공이다
    http.post(api('/v1/admin/events/:eventId/cancel'), async ({ params, request }) => {
        const item = findItem(params.eventId);
        if (!item) return fail(404, 'RESOURCE_NOT_FOUND', '이벤트를 찾을 수 없습니다');
        const reason = await readReason(request);
        if (!reason) return fail(400, 'COMMON-002', '사유를 입력해야 합니다');

        const now = mockNow();
        const previous = effectiveStatus(item, now.getTime());
        // 이미 취소된 이벤트는 추가 반환·상태 변경 없이 현행 계약의 충돌을 반환한다.
        if (item.status === 'CANCELED') {
            return fail(409, 'EVENT-017', '이미 취소된 이벤트입니다.');
        }
        const refunded = refundAndRelease(item);
        item.status = 'CANCELED';
        item.canceledAt = now.toISOString();
        item.updatedAt = now.toISOString();
        return ok(operationResult(item, previous, refunded, now));
    }),
];
