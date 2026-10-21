import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { apiClient } from '@shared/api/client';
import { VIRTUAL_CLOCK_STORAGE_KEY } from '@shared/model/virtualClock';
import { IDEMPOTENCY_HEADER } from '@shared/utils/idempotencyKey';

import { resetMockDraws } from './draw';

/*
 * ADR-022·ADR-026 — 공개는 추첨 확정·정합성 검증·시간 경과로 생기지 않고
 * 관리자의 당첨자 공개 요청(POST /admin/draws/{runId}/result-confirmation) 성공으로만 생긴다.
 * 이 목업이 같은 경계를 지키는지와, 공개 사실이 관리자 상태·사용자 이벤트·공개 결과에
 * 일관되게 반영되는지 확인한다. 이미 공개된 과거 데이터는 명시적 시드로만 구분한다.
 */

interface Envelope<T> {
    success: boolean;
    code: string;
    data: T;
}

interface Page<T> {
    items: T[];
    page: number;
    size: number;
    totalElements: number;
}

interface RunBody {
    id: string;
    runNumber: number;
    drawType: string;
    status: string;
}

const call = <T = unknown>(
    method: 'get' | 'post',
    path: string,
    options: { body?: unknown; key?: string; userId?: string } = {},
) =>
    apiClient.request<Envelope<T>>({
        method,
        url: path,
        data: options.body,
        headers: {
            ...(options.key ? { [IDEMPOTENCY_HEADER]: options.key } : {}),
            ...(options.userId ? { 'X-User-ID': options.userId } : {}),
        },
        validateStatus: () => true,
    });

const setClock = (at: Date | null) => {
    if (at) sessionStorage.setItem(VIRTUAL_CLOCK_STORAGE_KEY, at.toISOString());
    else sessionStorage.removeItem(VIRTUAL_CLOCK_STORAGE_KEY);
};

const plusHours = (h: number) => new Date(Date.now() + h * 60 * 60 * 1000);

// 마감된 사용자 이벤트 — 최초 추첨은 끝났지만 아직 공개되지 않았다 (공개 시드가 아니다)
const ENDED_EVENT = 'evt-106';
// 마감 전이라 아직 응모할 수 있는 래플 — 응모 뒤 시계를 앞으로 옮겨 공개 전 상태를 만든다
const OPEN_EVENT = 'evt-101';
// 명시적으로 공개된 시드 — 사용자 목업의 status:'drawn'이 과거 공개를 뜻한다
const SEED_PUBLISHED_EVENT = 'evt-009';

const results = (eventId: string) =>
    call<{
        isPublished: boolean;
        displayStatus: string;
        publishedAt: string | null;
        revision: number | null;
    }>('get', `/v1/events/${eventId}/results`);

const adminEventStatus = async (eventId: string) => {
    const res = await call<{ status: string }>('get', `/v1/admin/events/${eventId}`);
    return res.data.data.status;
};

const userEventStatus = async (eventId: string) => {
    const res = await call<{ status: string }>('get', `/v1/events/${eventId}`);
    return res.data.data.status;
};

const firstRunId = async (eventId: string) => {
    const list = await call<Page<RunBody>>('get', `/v1/admin/events/${eventId}/draws`);
    expect(list.status).toBe(200);
    return list.data.data.items.find((r) => r.runNumber === 1)!.id;
};

describe('공개 경계 (ADR-022)', () => {
    beforeEach(() => {
        resetMockDraws();
    });
    afterEach(() => {
        setClock(null);
    });

    it('추첨이 확정되고 정합성 검증·시간 경과가 지나도 공개되지 않는다', async () => {
        // 최초 추첨은 확정됐다 — 실행 확정만으로는 공개가 생기지 않는다
        const draws = await call<Page<RunBody>>('get', `/v1/admin/events/${ENDED_EVENT}/draws`);
        expect(draws.data.data.items[0]).toMatchObject({
            drawType: 'INITIAL',
            status: 'CONFIRMED',
        });
        expect((await results(ENDED_EVENT)).data.data.isPublished).toBe(false);
        expect(await adminEventStatus(ENDED_EVENT)).not.toBe('PUBLISHED');

        // 정합성 검증도 공개를 발생시키지 않는다
        const check = await call('post', `/v1/admin/draws/${draws.data.data.items[0]!.id}/checks`);
        expect(check.status).toBe(201);
        expect((await results(ENDED_EVENT)).data.data.isPublished).toBe(false);

        // 시간을 하루 앞으로 옮겨도 마찬가지다 — 관리자 상태도 공개로 바뀌지 않는다
        setClock(plusHours(24));
        expect((await results(ENDED_EVENT)).data.data.isPublished).toBe(false);
        expect((await results(ENDED_EVENT)).data.data.displayStatus).toBe('WAITING');
        expect(await adminEventStatus(ENDED_EVENT)).toBe('DRAW_CONFIRMED');
        expect(await userEventStatus(ENDED_EVENT)).toBe('CLOSED');

        const changes = await call<Page<unknown>>(
            'get',
            `/v1/admin/events/${ENDED_EVENT}/result-changes`,
        );
        expect(changes.data.data.totalElements).toBe(0);
    });

    it('응모한 사용자도 공개 전에는 본인 결과를 받지 못한다', async () => {
        const userId = 'vu-pub-boundary';
        const entry = await call('post', `/v1/events/${OPEN_EVENT}/entries`, {
            body: { tickets: { BRONZE: 1 } },
            key: crypto.randomUUID(),
            userId,
        });
        expect(entry.status).toBe(201);

        // 마감·추첨 시각이 지나도 공개 전이다 — 본인 결과는 내려오지 않는다
        setClock(plusHours(24));
        const mine = await call<{ result: string; isPublished: boolean }>(
            'get',
            `/v1/events/${OPEN_EVENT}/my-result`,
            { userId },
        );
        expect(mine.data.data.isPublished).toBe(false);
        expect(mine.data.data.result).toBe('PENDING');
    });

    it('당첨자 공개 요청이 성공해야만 공개되고, 재요청은 중복 공개를 만들지 않는다', async () => {
        const runId = await firstRunId(ENDED_EVENT);
        expect((await results(ENDED_EVENT)).data.data.isPublished).toBe(false);

        const publish = () =>
            call<{ isPublished: boolean; revision: number | null; publishedAt: string | null }>(
                'post',
                `/v1/admin/draws/${runId}/result-confirmation`,
            );

        const published = await publish();
        expect(published.status).toBe(200);
        expect(published.data.data.isPublished).toBe(true);
        expect(published.data.data.revision).toBe(1);
        expect(published.data.data.publishedAt).toBeTruthy();

        // 공개 사실이 관리자 상태·사용자 이벤트·공개 결과에 일관되게 나타난다
        expect(await adminEventStatus(ENDED_EVENT)).toBe('PUBLISHED');
        expect(await userEventStatus(ENDED_EVENT)).toBe('PUBLISHED');
        const publicResults = await results(ENDED_EVENT);
        expect(publicResults.data.data.isPublished).toBe(true);
        expect(publicResults.data.data.displayStatus).toBe('PUBLISHED');
        expect(publicResults.data.data.revision).toBe(1);

        // 같은 실행의 재요청은 같은 결과를 돌려주고 새 공개 버전을 만들지 않는다
        const retry = await publish();
        expect(retry.status).toBe(200);
        expect(retry.data.data).toEqual(published.data.data);
        const changes = await call<Page<{ revision: number }>>(
            'get',
            `/v1/admin/events/${ENDED_EVENT}/result-changes`,
        );
        expect(changes.data.data.totalElements).toBe(1);
    });

    it('이미 공개된 시드 이벤트만 처음부터 공개 상태다 — 시각만으로 공개되지 않는다', async () => {
        // 명시적으로 공개된 시드는 조회 즉시 공개 상태다
        expect((await results(SEED_PUBLISHED_EVENT)).data.data.isPublished).toBe(true);
        expect(await adminEventStatus(SEED_PUBLISHED_EVENT)).toBe('PUBLISHED');

        // 같은 시각의 공개 시드가 아닌 마감 이벤트는 공개되지 않았다
        expect((await results(ENDED_EVENT)).data.data.isPublished).toBe(false);
    });
});
