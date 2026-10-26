import { useMutation, useQueryClient } from '@tanstack/react-query';

import { GAMES_API_PATH, GAMES_KEY } from '@entities/game';
import { TICKETS_KEY } from '@entities/ticket';
import { apiClient } from '@shared/api/client';
import { envelopeSchema } from '@shared/api/envelopeSchema';

import type { ValidationData } from '../model/types';

import { gameStartSchema, playResultSchema } from '../model/types';

export interface GameSubmission {
    gameId: string;
    playId: string;
    body: { playToken: string; validationData: ValidationData };
}
export function useStartGamePlay() {
    return useMutation({
        retry: false,
        mutationFn: async (gameId: string) => {
            const { data } = await apiClient.post<unknown>(`${GAMES_API_PATH}/${gameId}/plays`);
            return envelopeSchema(gameStartSchema).parse(data).data;
        },
    });
}
export function useSubmitGamePlay() {
    const client = useQueryClient();
    return useMutation({
        retry: false,
        mutationFn: async ({ gameId, playId, body }: GameSubmission) => {
            const { data } = await apiClient.put<unknown>(
                `${GAMES_API_PATH}/${gameId}/plays/${playId}/result`,
                body,
            );
            const result = envelopeSchema(playResultSchema).parse(data).data;
            if (result.playId !== playId)
                throw new Error(
                    '다른 플레이의 결과를 받았습니다. 원본 기록으로 다시 확인해 주세요.',
                );
            return result;
        },
        onSuccess: (result) => {
            if (result.status === 'PROCESSING') return;
            void client.invalidateQueries({ queryKey: GAMES_KEY });
            void client.invalidateQueries({ queryKey: TICKETS_KEY });
        },
    });
}
