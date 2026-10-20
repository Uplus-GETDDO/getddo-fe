import { useMutation, useQueryClient } from '@tanstack/react-query';

import { GAMES_KEY, gamePlayApiPath } from '@entities/game';
import { TICKETS_KEY } from '@entities/ticket';
import { apiClient } from '@shared/api/client';
import { envelopeSchema } from '@shared/api/envelopeSchema';
import { createIdempotencyKey, IDEMPOTENCY_HEADER } from '@shared/utils/idempotencyKey';

import { playResultSchema } from '../model/types';

/**
 * 플레이 결과 제출 — 같은 플레이가 재시도로 두 번 반영되지 않게 멱등키를 붙인다.
 * TODO: spec 초안은 G03(POST /games/{gameId}/plays → playId·playToken 발급) → G04(PUT .../result) 구조다.
 * playId 계약이 확정되면 멱등키 대신 서버 발급 playId로 재시도를 식별한다 (getddo-spec 게임 규칙)
 */
export function useSubmitGamePlay() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ gameId, score }: { gameId: string; score: number }) => {
            const { data } = await apiClient.post<unknown>(
                gamePlayApiPath(gameId),
                { score },
                { headers: { [IDEMPOTENCY_HEADER]: createIdempotencyKey() } },
            );
            return envelopeSchema(playResultSchema).parse(data).data;
        },
        onSuccess: () => {
            // 최고점·오늘 플레이·오늘 받은 응모권과, 보상으로 바뀐 응모권 잔액·이력을 다시 받아온다
            void queryClient.invalidateQueries({ queryKey: GAMES_KEY });
            void queryClient.invalidateQueries({ queryKey: TICKETS_KEY });
        },
    });
}
