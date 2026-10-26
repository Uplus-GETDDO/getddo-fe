import { afterEach, describe, expect, it, vi } from 'vitest';

import { apiClient } from '@shared/api/client';
interface Start {
    playId: string;
    playToken: string;
}
interface Result {
    status: string;
    score: number | null;
    reward: { ticketCount: number } | null;
}
interface Statistics {
    bestScore: number;
    totalScore: number;
    validPlayCount: number;
    rewardClaimedToday: boolean;
}
const id = '0199f000-0000-7000-8000-000000000103';
const freeze = (iso: string) => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(iso));
};
afterEach(() => vi.useRealTimers());
describe('게임 계약 목업', () => {
    it.each(['2026-10-20', '2026-10-31'])(
        '%s KST 자정에도 누적 통계와 최초 결과를 보존한다',
        async (day) => {
            const headers = { 'X-User-ID': crypto.randomUUID(), 'X-User-Role': 'USER' };
            const start = async () =>
                (
                    await apiClient.post<{ data: Start }>(`/v1/games/${id}/plays`, undefined, {
                        headers,
                    })
                ).data.data;
            const submit = (play: { playId: string; playToken: string }, times: number[]) =>
                apiClient.put<{ data: Result }>(
                    `/v1/games/${id}/plays/${play.playId}/result`,
                    {
                        playToken: play.playToken,
                        validationData: {
                            taps: times.map((elapsedMs, i) => ({ sequence: i + 1, elapsedMs })),
                        },
                    },
                    { headers },
                );
            const stats = async () =>
                (
                    await apiClient.get<{ data: Statistics }>(`/v1/games/${id}/statistics/me`, {
                        headers,
                    })
                ).data.data;
            freeze(`${day}T14:59:59Z`);
            const play = await start();
            const result = (await submit(play, [304, 1240, 954, 0])).data.data;
            expect(result).toMatchObject({
                status: 'VALID',
                score: 50,
                reward: { ticketCount: 1 },
            });
            expect((await submit(play, [304, 1240, 954, 0])).data.data).toEqual(result);
            expect(await stats()).toMatchObject({
                bestScore: 50,
                totalScore: 50,
                validPlayCount: 1,
                rewardClaimedToday: true,
            });
            freeze(`${day}T15:00:00Z`);
            expect(await stats()).toMatchObject({
                bestScore: 50,
                totalScore: 50,
                validPlayCount: 1,
                rewardClaimedToday: false,
            });
            expect((await submit(play, [304, 1240, 954, 0])).data.data).toEqual(result);
            expect(
                (await submit(await start(), [304, 1240, 954, 0])).data.data.reward,
            ).not.toBeNull();
            expect(await stats()).toMatchObject({
                totalScore: 100,
                validPlayCount: 2,
                rewardClaimedToday: true,
            });
            freeze(`${day}T14:59:59Z`);
            expect(await stats()).toMatchObject({ rewardClaimedToday: true, validPlayCount: 2 });
            expect((await submit(await start(), [304, 1240, 954, 0])).data.data.reward).toBeNull();
            await expect(submit(play, [0])).rejects.toMatchObject({
                status: 409,
                code: 'GAME-006',
            });
        },
    );
    it('미달 VALID 0점은 일일 보상을 소진하지 않으며 ADMIN 통계는 거절한다', async () => {
        const headers = { 'X-User-ID': crypto.randomUUID(), 'X-User-Role': 'USER' };
        const play = (
            await apiClient.post<{ data: Start }>(`/v1/games/${id}/plays`, undefined, { headers })
        ).data.data;
        const result = (
            await apiClient.put<{ data: Result }>(
                `/v1/games/${id}/plays/${play.playId}/result`,
                {
                    playToken: play.playToken,
                    validationData: { taps: [{ sequence: 1, elapsedMs: 0 }] },
                },
                { headers },
            )
        ).data.data;
        expect(result).toMatchObject({ status: 'VALID', score: 0, reward: null });
        expect(
            (
                await apiClient.get<{ data: Statistics }>(`/v1/games/${id}/statistics/me`, {
                    headers,
                })
            ).data.data,
        ).toMatchObject({ validPlayCount: 1, rewardClaimedToday: false });
        await expect(
            apiClient.get<{ data: Statistics }>(`/v1/games/${id}/statistics/me`, {
                headers: { ...headers, 'X-User-Role': 'ADMIN' },
            }),
        ).rejects.toMatchObject({ status: 403 });
    });
});
