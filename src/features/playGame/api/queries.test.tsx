import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, act } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import { server } from '../../../mocks/server';
import { useStartGamePlay, useSubmitGamePlay } from './queries';

const gameId = '0199f000-0000-7000-8000-000000000101';
const playId = '0199f000-0000-7000-8000-000000000102';
function wrapper({ children }: { children: React.ReactNode }) {
    return (
        <QueryClientProvider
            client={
                new QueryClient({
                    defaultOptions: { mutations: { retry: false }, queries: { retry: false } },
                })
            }
        >
            {children}
        </QueryClientProvider>
    );
}
describe('게임 시작과 결과 요청', () => {
    it('UUID plays에 본문 없이 시작한다', async () => {
        let body = 'unset';
        server.use(
            http.post('*/v1/games/:id/plays', async ({ request, params }) => {
                expect(params.id).toBe(gameId);
                body = await request.text();
                return HttpResponse.json(
                    {
                        success: true,
                        data: {
                            playId,
                            playToken: 'token',
                            ruleVersion: 'takko-timing-v1',
                            startedAt: '2026-10-20T01:00:00Z',
                            rules: { points: 10, perfectPoints: 20, minimumRewardScore: 50 },
                            gameData: { generatorVersion: 'takko-timing-generator-v1', seed: 1 },
                        },
                    },
                    { status: 201 },
                );
            }),
        );
        const { result } = renderHook(() => useStartGamePlay(), { wrapper });
        await act(async () => {
            await result.current.mutateAsync(gameId);
        });
        expect(body).toBe('');
    });
    it('PROCESSING 이후 원본과 같은 본문을 PUT하고 최초 확정 결과를 받는다', async () => {
        const bodies: unknown[] = [];
        server.use(
            http.put('*/v1/games/:id/plays/:playId/result', async ({ request, params }) => {
                expect(params.playId).toBe(playId);
                bodies.push(await request.json());
                return HttpResponse.json(
                    {
                        success: true,
                        data: {
                            playId,
                            status: bodies.length === 1 ? 'PROCESSING' : 'VALID',
                            score: bodies.length === 1 ? null : 0,
                            completedAt: bodies.length === 1 ? null : '2026-10-20T01:01:00Z',
                            reward: null,
                        },
                    },
                    { status: bodies.length === 1 ? 202 : 200 },
                );
            }),
        );
        const { result } = renderHook(() => useSubmitGamePlay(), { wrapper });
        const input = {
            gameId,
            playId,
            body: { playToken: 'token', validationData: { taps: [{ sequence: 1, elapsedMs: 0 }] } },
        };
        await act(async () => {
            expect((await result.current.mutateAsync(input)).status).toBe('PROCESSING');
        });
        await act(async () => {
            expect((await result.current.mutateAsync(input)).status).toBe('VALID');
        });
        expect(bodies).toEqual([input.body, input.body]);
    });
});
