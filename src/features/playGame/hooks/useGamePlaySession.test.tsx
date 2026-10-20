import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import { server } from '../../../mocks/server';
import { useGamePlaySession } from './useGamePlaySession';
const gameId = '0199f000-0000-7000-8000-000000000103';
const playId = '0199f000-0000-7000-8000-000000000104';
const start = {
    playId,
    playToken: 'token',
    ruleVersion: 'takko-timing-v1',
    startedAt: '2026-10-20T01:00:00Z',
    rules: { points: 10, perfectPoints: 20, minimumRewardScore: 50 },
    gameData: { generatorVersion: 'takko-timing-generator-v1', seed: 1 },
};
function setup(isUser = true) {
    const userId = crypto.randomUUID();
    const client = new QueryClient({
        defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    return renderHook(() => useGamePlaySession(gameId, userId, isUser, 'TAKKO_TIMING'), {
        wrapper: ({ children }) => (
            <QueryClientProvider client={client}>{children}</QueryClientProvider>
        ),
    });
}
describe('원본 제출과 재시도 수명', () => {
    it('응답 유실 후 새 판을 발급하지 않고 복제한 원본으로 재시도한다', async () => {
        let starts = 0;
        const bodies: unknown[] = [];
        server.use(
            http.post('*/v1/games/:gameId/plays', () => {
                starts++;
                return HttpResponse.json({ success: true, data: start }, { status: 201 });
            }),
            http.put('*/v1/games/:id/plays/:playId/result', async ({ request }) => {
                bodies.push(await request.json());
                return bodies.length === 1
                    ? HttpResponse.error()
                    : HttpResponse.json({
                          success: true,
                          data: {
                              playId,
                              status: 'VALID',
                              score: 0,
                              completedAt: '2026-10-20T01:01:00Z',
                              reward: null,
                          },
                      });
            }),
        );
        const { result } = setup();
        await act(async () => {
            await result.current.begin();
        });
        const input = { taps: [{ sequence: 1, elapsedMs: 0 }] };
        await act(async () => {
            await result.current.complete(0, input);
        });
        input.taps[0]!.elapsedMs = 100;
        expect(result.current.pending?.body.validationData).toEqual({
            taps: [{ sequence: 1, elapsedMs: 0 }],
        });
        await act(async () => {
            await result.current.begin();
        });
        expect(starts).toBe(1);
        await act(async () => {
            await result.current.retry();
        });
        expect(bodies).toHaveLength(2);
        expect(bodies[0]).toEqual(bodies[1]);
        expect(result.current.result?.status).toBe('VALID');
    });
    it('ADMIN 체험은 시작만 하고 결과를 제출하지 않는다', async () => {
        let submits = 0;
        server.use(
            http.post('*/v1/games/:gameId/plays', () =>
                HttpResponse.json({ success: true, data: start }, { status: 201 }),
            ),
            http.put('*/v1/games/:id/plays/:playId/result', () => {
                submits++;
                return HttpResponse.error();
            }),
        );
        const { result } = setup(false);
        await act(async () => {
            await result.current.begin();
        });
        await act(async () => {
            await result.current.complete(0, { taps: [{ sequence: 1, elapsedMs: 0 }] });
        });
        expect(submits).toBe(0);
        expect(result.current.pending).toBeUndefined();
    });
    it.each([404, 409, 413, 429])(
        'HTTP %i 오류를 구분하고 같은 입력을 유지한다',
        async (status) => {
            server.use(
                http.post('*/v1/games/:gameId/plays', () =>
                    HttpResponse.json({ success: true, data: start }, { status: 201 }),
                ),
                http.put('*/v1/games/:id/plays/:playId/result', () =>
                    HttpResponse.json(
                        { success: false, code: `GAME-${status}`, message: '오류', data: null },
                        { status, headers: { 'Retry-After': '1' } },
                    ),
                ),
            );
            const { result } = setup();
            await act(async () => {
                await result.current.begin();
            });
            await act(async () => {
                await result.current.complete(0, { taps: [{ sequence: 1, elapsedMs: 0 }] });
            });
            expect(result.current.error).toBeTruthy();
            expect(result.current.pending?.playId).toBe(playId);
            if (status === 429) expect(result.current.retryReady).toBe(false);
        },
    );
    it('PROCESSING 응답 뒤에는 새 판을 만들지 않고 같은 판을 보존한다', async () => {
        server.use(
            http.post('*/v1/games/:gameId/plays', () =>
                HttpResponse.json({ success: true, data: start }, { status: 201 }),
            ),
            http.put('*/v1/games/:id/plays/:playId/result', () =>
                HttpResponse.json(
                    {
                        success: true,
                        data: {
                            playId,
                            status: 'PROCESSING',
                            score: null,
                            completedAt: null,
                            reward: null,
                        },
                    },
                    { status: 202 },
                ),
            ),
        );
        const { result } = setup();
        await act(async () => {
            await result.current.begin();
        });
        await act(async () => {
            await result.current.complete(0, { taps: [{ sequence: 1, elapsedMs: 0 }] });
        });
        expect(result.current.result?.status).toBe('PROCESSING');
        expect(result.current.pending?.playId).toBe(playId);
        expect(result.current.retryReady).toBe(false);
    });
});
