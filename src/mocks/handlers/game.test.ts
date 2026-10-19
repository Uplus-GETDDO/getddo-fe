import { afterEach, describe, expect, it, vi } from 'vitest';

import { apiClient } from '@shared/api/client';

const freezeDate = (iso: string) => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(iso));
};

afterEach(() => vi.useRealTimers());

describe('게임 목업 KST 보상일', () => {
    it.each(['2026-10-20', '2026-10-31'])('%s 자정에 일일 상태만 초기화한다', async (day) => {
        const headers = { 'X-User-ID': `game-${crypto.randomUUID()}` };
        const play = (score: number) =>
            apiClient.post<{ data: { ticketsGranted: number; todayPlayCount: number } }>(
                '/v1/games/game-dino/play',
                { score },
                { headers },
            );
        const list = async () => {
            const { data } = await apiClient.get<{
                data: {
                    id: string;
                    rewardedToday: boolean;
                    todayPlayCount: number;
                    bestScore: number;
                }[];
            }>('/v1/games', { headers });
            return data.data.find((game) => game.id === 'game-dino');
        };
        freezeDate(`${day}T14:59:59Z`);
        expect((await play(500)).data.data.ticketsGranted).toBe(1);
        expect((await play(400)).data.data.ticketsGranted).toBe(0);
        expect(await list()).toMatchObject({
            rewardedToday: true,
            todayPlayCount: 2,
            bestScore: 500,
        });

        freezeDate(`${day}T15:00:00Z`);
        expect(await list()).toMatchObject({
            rewardedToday: false,
            todayPlayCount: 0,
            bestScore: 500,
        });
        expect((await play(400)).data.data.ticketsGranted).toBe(1);
        expect((await play(400)).data.data.ticketsGranted).toBe(0);

        freezeDate(`${day}T14:59:59Z`);
        expect((await play(400)).data.data.ticketsGranted).toBe(0);
        expect(await list()).toMatchObject({
            rewardedToday: true,
            todayPlayCount: 3,
            bestScore: 500,
        });
    });
});
