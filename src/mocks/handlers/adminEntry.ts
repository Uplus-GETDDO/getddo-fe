import { http } from 'msw';

import type { AdminEntry, AdminParticipant } from '@entities/entry';

import { env } from '@shared/config/env';

import { mockAdminEventExists } from './adminEvent';
import { fail, ok } from './response';

const api = (path: string) => `${env.apiBaseUrl}${path}`;

const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const userId = (n: number) => uuid(n);
const eventId = (n: number) => `10000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

const zero = { BRONZE: 0, SILVER: 0, GOLD: 0, PLATINUM: 0 };
const sum = (m: Record<string, number>) => Object.values(m).reduce((a, b) => a + b, 0);

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
        requestedAt: '2026-10-19T03:00:00Z',
        acceptedAt: accepted ? '2026-10-19T03:00:01Z' : null,
        rejectionCode: accepted ? null : 'INSUFFICIENT_TICKETS',
        rejectionReason: accepted ? null : '응모권이 부족합니다.',
        userId: userId(1),
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
        requestedAt: '2026-10-18T05:00:00Z',
        acceptedAt: '2026-10-18T05:00:01Z',
    }),
    mkEntry(3, {
        status: 'REJECTED',
        userId: userId(3),
        eventId: eventId(1),
        requestedAt: '2026-10-19T07:00:00Z',
    }),
    mkEntry(4, {
        status: 'ACCEPTED',
        userId: userId(1),
        eventId: eventId(2),
        eventTitle: 'PLATINUM 특별 추첨',
        requestedTicketsByGrade: { ...zero, PLATINUM: 1 },
        requestedAt: '2026-10-19T09:00:00Z',
        acceptedAt: '2026-10-19T09:00:01Z',
    }),
    mkEntry(5, {
        status: 'REJECTED',
        userId: userId(4),
        eventId: eventId(2),
        eventTitle: 'PLATINUM 특별 추첨',
        rejectionCode: 'ALREADY_ENTERED',
        rejectionReason: '이미 응모한 이벤트입니다.',
        requestedAt: '2026-10-19T10:00:00Z',
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
