import { afterEach, describe, expect, it } from 'vitest';

import type { MyResult, PublicResults } from '@entities/drawResult';

import { myResultSchema, publicResultsSchema } from '@entities/drawResult';
import { apiClient } from '@shared/api/client';
import { VIRTUAL_CLOCK_STORAGE_KEY } from '@shared/model/virtualClock';
import { IDEMPOTENCY_HEADER } from '@shared/utils/idempotencyKey';

async function results(eventId: string): Promise<PublicResults> {
    const { data } = await apiClient.get<unknown>(`/v1/events/${eventId}/results`);
    return publicResultsSchema.parse((data as { data: unknown }).data);
}

// 어제 끝난 래플이라 시각과 무관하게 항상 발표 완료다
const DRAWN_EVENT_ID = 'evt-107';
// 기준 시각 +2시간에 열리는 래플이라 아직 발표 전이다
const PENDING_EVENT_ID = 'evt-105';

describe('공개 추첨 결과 목업 (E08)', () => {
    it('발표 전에는 명단과 공개 정보를 하나도 싣지 않는다', async () => {
        const data = await results(PENDING_EVENT_ID);

        expect(data.isPublished).toBe(false);
        expect(data.displayStatus).toBe('WAITING');
        expect(data.prizes).toEqual([]);
        expect(data.publishedAt).toBeNull();
        expect(data.revision).toBeNull();
    });

    // 계약 가드 — 스키마 파싱은 미지 필드를 버리므로 원본 응답으로 확인한다 (ADR-022)
    it('공개 결과 응답에 발표 예정 시각(publicationScheduledAt)을 싣지 않는다', async () => {
        const { data } = await apiClient.get<unknown>(`/v1/events/${DRAWN_EVENT_ID}/results`);
        expect((data as { data: unknown }).data).not.toHaveProperty('publicationScheduledAt');
    });

    it('발표 뒤에는 등수 내림차순으로 명단을 준다', async () => {
        const data = await results(DRAWN_EVENT_ID);

        expect(data.isPublished).toBe(true);
        expect(data.displayStatus).toBe('PUBLISHED');
        expect(data.prizes.length).toBeGreaterThan(0);

        const ranks = data.prizes.map((prize) => prize.rank);
        expect(ranks).toEqual([...ranks].sort((a, b) => b - a));
    });

    it('당첨자는 마스킹된 값만 담는다', async () => {
        const [prize] = (await results(DRAWN_EVENT_ID)).prizes;
        const winner = prize?.winners[0];

        expect(winner).toBeDefined();
        expect(winner?.maskedName).toMatch(/\*/);
        expect(winner?.maskedPhoneNum).toMatch(/^\d{4}$/);
        // 원본 개인정보·사용자 ID는 공개 결과에 담기지 않는다 (05-api/drawing.md)
        expect(winner).not.toHaveProperty('userId');
    });

    it('같은 이벤트를 다시 조회해도 명단이 바뀌지 않는다', async () => {
        const first = await results(DRAWN_EVENT_ID);
        const second = await results(DRAWN_EVENT_ID);

        expect(second.prizes).toEqual(first.prizes);
    });

    it('없는 이벤트는 404로 답한다', async () => {
        await expect(results('evt-nope')).rejects.toMatchObject({
            status: 404,
            code: 'EVENT_NOT_FOUND',
        });
    });
});

// ── E09 본인 결과 ──

/** 발표는 마감 + 5분이다 (ADR-009) — 그 경계를 넘나들며 확인한다 */
const ANNOUNCE_DELAY_MS = 5 * 60 * 1000;
/** 진행 중이라 응모할 수 있는 래플 */
const OPEN_EVENT_ID = 'evt-101';

const asUser = (userId: string) => {
    apiClient.defaults.headers.common['X-User-ID'] = userId;
    apiClient.defaults.headers.common['X-User-Role'] = 'USER';
    apiClient.defaults.headers.common['X-User-Membership'] = 'vvip';
};

const setClock = (at: Date | null) => {
    if (at) sessionStorage.setItem(VIRTUAL_CLOCK_STORAGE_KEY, at.toISOString());
    else sessionStorage.removeItem(VIRTUAL_CLOCK_STORAGE_KEY);
};

async function myResult(eventId: string): Promise<MyResult> {
    const { data } = await apiClient.get<unknown>(`/v1/events/${eventId}/my-result`);
    return myResultSchema.parse((data as { data: unknown }).data);
}

async function endsAtOf(eventId: string): Promise<number> {
    const { data } = await apiClient.get<unknown>(`/v1/events/${eventId}`);
    return new Date((data as { data: { endsAt: string } }).data.endsAt).getTime();
}

async function enter(eventId: string) {
    await apiClient.post(
        `/v1/events/${eventId}/entries`,
        { tickets: { BRONZE: 1 } },
        { headers: { [IDEMPOTENCY_HEADER]: crypto.randomUUID() } },
    );
}

describe('본인 결과 목업 (E09)', () => {
    afterEach(() => {
        setClock(null);
    });

    it('응모하지 않았으면 발표가 끝나도 NOT_ENTERED다', async () => {
        asUser('vu-e09-absent');
        setClock(new Date((await endsAtOf(DRAWN_EVENT_ID)) + ANNOUNCE_DELAY_MS + 60_000));

        // 공개 명단은 열렸지만 내 결과는 '응모 안 함'이어야 한다 — 낙첨으로 적으면 안 된다
        expect((await results(DRAWN_EVENT_ID)).isPublished).toBe(true);

        const mine = await myResult(DRAWN_EVENT_ID);
        expect(mine.result).toBe('NOT_ENTERED');
        expect(mine.prize).toBeNull();
    });

    it('응모했고 공개 전이면 추첨 시각이 지나도 PENDING을 유지한다', async () => {
        asUser('vu-e09-pending');
        await enter(OPEN_EVENT_ID);

        // 마감은 지났지만 발표 예정 시각 전이다
        setClock(new Date((await endsAtOf(OPEN_EVENT_ID)) + 60_000));

        const mine = await myResult(OPEN_EVENT_ID);
        expect(mine.result).toBe('PENDING');
        expect(mine.prize).toBeNull();
        // 공개 전에는 revision도 내려주지 않는다 (05-api/drawing.md)
        expect(mine.revision).toBeNull();
    });

    it('발표 후에는 당첨 여부와 경품을 돌려준다', async () => {
        asUser('vu-e09-won');
        await enter(OPEN_EVENT_ID);
        setClock(new Date((await endsAtOf(OPEN_EVENT_ID)) + ANNOUNCE_DELAY_MS + 60_000));

        const mine = await myResult(OPEN_EVENT_ID);
        expect(mine.isPublished).toBe(true);
        expect(mine.result).toBe('WON');
        expect(mine.prize?.rank).toBe(1);
    });

    it('같은 사용자·이벤트면 다시 물어도 결과가 바뀌지 않는다', async () => {
        asUser('vu-e09-stable');
        await enter(OPEN_EVENT_ID);
        setClock(new Date((await endsAtOf(OPEN_EVENT_ID)) + ANNOUNCE_DELAY_MS + 60_000));

        // 30초 폴링마다 당첨과 낙첨이 뒤집히면 발표된 결과로 보이지 않는다
        const first = await myResult(OPEN_EVENT_ID);
        const second = await myResult(OPEN_EVENT_ID);
        expect(second.result).toBe(first.result);
        expect(second.prize?.name).toBe(first.prize?.name);
    });

    it('없는 이벤트는 404로 답한다', async () => {
        asUser('vu-e09-absent');
        await expect(myResult('evt-nope')).rejects.toMatchObject({
            status: 404,
            code: 'EVENT_NOT_FOUND',
        });
    });
});
