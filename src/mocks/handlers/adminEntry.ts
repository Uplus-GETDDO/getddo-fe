import { http } from 'msw';

import type { AdminEntry, AdminParticipant } from '@entities/entry';

import { env } from '@shared/config/env';

import { DAY, HOUR, demoTime } from '../demoTime';
import { mockAdminEventExists } from './adminEvent';
import { fail, ok } from './response';

const api = (path: string) => `${env.apiBaseUrl}${path}`;

const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const userId = (n: number) => uuid(n);
const eventId = (n: number) => `10000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

const zero = { BRONZE: 0, SILVER: 0, GOLD: 0, PLATINUM: 0 };
const sum = (m: Record<string, number>) => Object.values(m).reduce((a, b) => a + b, 0);

// ADR-028 — 표시용 현재 이름. 4번 사용자는 BE 미배포 구간의 이름 생략 경로를 검증하기 위해 비워 둔다
const ENTRY_USER_NAMES: Record<string, string> = {
    [userId(1)]: '김도윤',
    [userId(2)]: '박서연',
    [userId(3)]: '이하늘',
};

// AO06/AO07 목업 — 거절 건은 participantId=null·차감 0을 보존한다.
// 이벤트·사용자 ID는 계약상 UUID라 evt-*/vu-* 목업 식별자와 별도 체계를 쓴다.
const mkEntry = (
    n: number,
    overrides: Partial<AdminEntry> & Pick<AdminEntry, 'status'>,
): AdminEntry => {
    const requested = overrides.requestedTicketsByGrade ?? { ...zero, BRONZE: 1 };
    const accepted = overrides.status === 'ACCEPTED';
    const deducted = overrides.deductedTicketsByGrade ?? (accepted ? requested : { ...zero });
    return {
        id: uuid(9000 + n),
        eventId: eventId(1),
        eventTitle: '10월 럭키 드로우',
        requestedTicketCount: sum(requested),
        requestedTicketsByGrade: requested,
        deductedTicketCount: sum(deducted),
        deductedTicketsByGrade: deducted,
        requestedAt: demoTime(-6 * DAY),
        acceptedAt: accepted ? demoTime(-6 * DAY + 1000) : null,
        rejectionCode: accepted ? null : 'INSUFFICIENT_TICKETS',
        rejectionReason: accepted ? null : '응모권이 부족합니다.',
        userId: userId(1),
        userName: ENTRY_USER_NAMES[overrides.userId ?? userId(1)] ?? null,
        participantId: accepted ? uuid(8000 + n) : null,
        ...overrides,
        status: overrides.status,
    };
};

const adminEntries: AdminEntry[] = [
    mkEntry(1, { status: 'ACCEPTED', userId: userId(1) }),
    mkEntry(2, {
        status: 'ACCEPTED',
        userId: userId(2),
        eventId: eventId(1),
        requestedTicketsByGrade: { ...zero, GOLD: 2 },
        requestedAt: demoTime(-7 * DAY),
        acceptedAt: demoTime(-7 * DAY + 1000),
    }),
    mkEntry(3, {
        status: 'REJECTED',
        userId: userId(3),
        eventId: eventId(1),
        requestedAt: demoTime(-6 * DAY + 4 * HOUR),
    }),
    mkEntry(4, {
        status: 'ACCEPTED',
        userId: userId(1),
        eventId: eventId(2),
        eventTitle: 'PLATINUM 특별 추첨',
        requestedTicketsByGrade: { ...zero, PLATINUM: 1 },
        requestedAt: demoTime(-6 * DAY + 6 * HOUR),
        acceptedAt: demoTime(-6 * DAY + 6 * HOUR + 1000),
    }),
    mkEntry(5, {
        status: 'REJECTED',
        userId: userId(4),
        eventId: eventId(2),
        eventTitle: 'PLATINUM 특별 추첨',
        rejectionCode: 'ALREADY_ENTERED',
        rejectionReason: '이미 응모한 이벤트입니다.',
        requestedAt: demoTime(-6 * DAY + 7 * HOUR),
    }),
];

const knownEventIds = new Set(adminEntries.map((e) => e.eventId));

// 응모 fixture에 없는 이벤트라도 관리자 이벤트 목업에 있으면 참여자 조회는 빈 목록으로 응답한다
const isKnownEvent = (eventId: string) =>
    knownEventIds.has(eventId) || mockAdminEventExists(eventId);

export const adminEntryHandlers = [
    http.get(api('/v1/admin/entries'), ({ request }) => {
        const params = new URL(request.url).searchParams;
        const userIdParam = params.get('userId');
        const eventIdParam = params.get('eventId');
        const status = params.get('status');
        const from = params.get('from');
        const to = params.get('to');
        const page = Math.max(1, Number(params.get('page') ?? 1));
        const size = Math.min(100, Math.max(1, Number(params.get('size') ?? 20)));

        const filtered = adminEntries
            .filter(
                (e) =>
                    (!userIdParam || e.userId === userIdParam) &&
                    (!eventIdParam || e.eventId === eventIdParam) &&
                    (!status || e.status === status) &&
                    (!from || e.requestedAt >= from) &&
                    (!to || e.requestedAt < to),
            )
            .sort((a, b) => b.requestedAt.localeCompare(a.requestedAt));
        return ok({
            items: filtered.slice((page - 1) * size, page * size),
            page,
            size,
            totalElements: filtered.length,
        });
    }),
    http.get(api('/v1/admin/events/:eventId/participants'), ({ params, request }) => {
        const eventIdParam = params.eventId as string;
        if (!isKnownEvent(eventIdParam)) {
            return fail(404, 'ENTRY-004', '이벤트를 찾을 수 없습니다.');
        }
        const query = new URL(request.url).searchParams;
        const page = Math.max(1, Number(query.get('page') ?? 1));
        const size = Math.min(100, Math.max(1, Number(query.get('size') ?? 20)));

        const byParticipant = new Map<string, AdminParticipant>();
        for (const e of adminEntries
            .filter((e) => e.eventId === eventIdParam && e.status === 'ACCEPTED' && e.participantId)
            .sort((a, b) => a.requestedAt.localeCompare(b.requestedAt))) {
            const existing = byParticipant.get(e.participantId!);
            if (existing) {
                existing.usedTicketCount += e.deductedTicketCount;
            } else {
                byParticipant.set(e.participantId!, {
                    id: e.participantId!,
                    eventId: e.eventId,
                    userId: e.userId,
                    userName: e.userName ?? null,
                    usedTicketCount: e.deductedTicketCount,
                    createdAt: e.requestedAt,
                });
            }
        }
        // 최초 응모 시각 내림차순 → 참여자 ID 내림차순 (AO07 정렬 계약)
        const items = [...byParticipant.values()].sort(
            (a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id),
        );
        return ok({
            items: items.slice((page - 1) * size, page * size),
            page,
            size,
            totalElements: items.length,
        });
    }),
];
