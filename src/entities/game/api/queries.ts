import { useQuery, useQueries } from '@tanstack/react-query';
import { z } from 'zod';

import { apiClient } from '@shared/api/client';
import { envelopeSchema } from '@shared/api/envelopeSchema';

import { gameSchema, gameDetailSchema, gameStatisticsSchema } from '../model/types';

export const GAMES_KEY = ['games'] as const;
export const GAMES_API_PATH = '/v1/games';
const statisticsOptions = (gameId: string) => ({
    queryKey: [...GAMES_KEY, gameId, 'statistics'],
    queryFn: async () => {
        const { data } = await apiClient.get<unknown>(`${GAMES_API_PATH}/${gameId}/statistics/me`);
        return envelopeSchema(gameStatisticsSchema).parse(data).data;
    },
    refetchInterval: 30_000,
});
export function useGameList() {
    return useQuery({
        queryKey: [...GAMES_KEY, 'list'],
        queryFn: async () => {
            const { data } = await apiClient.get<unknown>(GAMES_API_PATH);
            return envelopeSchema(z.array(gameSchema)).parse(data).data;
        },
    });
}
export function useGameDetail(gameId: string | undefined) {
    return useQuery({
        queryKey: [...GAMES_KEY, gameId, 'detail'],
        enabled: !!gameId,
        queryFn: async () => {
            const { data } = await apiClient.get<unknown>(`${GAMES_API_PATH}/${gameId}`);
            return envelopeSchema(gameDetailSchema).parse(data).data;
        },
    });
}
export function useGameStatistics(gameId: string | undefined, enabled: boolean) {
    return useQuery({ ...statisticsOptions(gameId ?? ''), enabled: !!gameId && enabled });
}
export function useGameStatisticsList(gameIds: string[], enabled: boolean) {
    return useQueries({ queries: gameIds.map((id) => ({ ...statisticsOptions(id), enabled })) });
}
