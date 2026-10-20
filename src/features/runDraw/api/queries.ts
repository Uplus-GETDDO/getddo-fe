import { useMutation, useQueryClient } from '@tanstack/react-query';

import {
    DRAWS_KEY,
    drawChecksApiPath,
    drawExecutionResponseSchema,
    drawResumeApiPath,
    drawVerificationSchema,
} from '@entities/drawResult';
import { awardCancellationResultSchema, winCancellationsApiPath } from '@entities/winner';
import { apiClient } from '@shared/api/client';
import { envelopeSchema } from '@shared/api/envelopeSchema';
import { IDEMPOTENCY_HEADER } from '@shared/utils/idempotencyKey';

// AD04 — 저장된 추첨 결과의 정합성 검증. 난수를 다시 돌리는 작업이 아니라 본문이 없다
export function useVerifyDraw() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (drawId: string) => {
            const { data } = await apiClient.post<unknown>(drawChecksApiPath(drawId));
            return envelopeSchema(drawVerificationSchema).parse(data).data;
        },
        onSuccess: () => {
            void queryClient.invalidateQueries({ queryKey: DRAWS_KEY });
        },
    });
}

// 실패한 최초 추첨 실행의 재개(GD-87) — 본문 없음. 200은 저장된 확정 결과, 202는 진행 중·미확정이라 같은 실행을 다시 조회한다.
// 멱등은 실행 ID로 서버가 보장해 멱등 헤더가 없다. 새 최초 실행을 만들지 않는다
export function useResumeDraw() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (runId: string) => {
            const { data } = await apiClient.post<unknown>(drawResumeApiPath(runId));
            return envelopeSchema(drawExecutionResponseSchema).parse(data).data;
        },
        onSuccess: () => {
            void queryClient.invalidateQueries({ queryKey: DRAWS_KEY });
        },
    });
}

interface CancelWinInput {
    winId: string;
    reason: string;
    /** 같은 취소 의도의 재시도는 같은 키를 쓴다 — 호출부(다이얼로그)가 의도 단위로 보관한다 */
    idempotencyKey: string;
}

// AD05 — 당첨 한 건의 취소와 재추첨 등록을 함께 요청한다 (202, 같은 요청 재시도는 200)
export function useCancelWin() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ winId, reason, idempotencyKey }: CancelWinInput) => {
            const { data } = await apiClient.post<unknown>(
                winCancellationsApiPath(winId),
                { reason },
                { headers: { [IDEMPOTENCY_HEADER]: idempotencyKey } },
            );
            return envelopeSchema(awardCancellationResultSchema).parse(data).data;
        },
        onSuccess: () => {
            // 취소된 결과와 새로 생긴 재추첨 실행이 목록·상세에 바로 반영된다
            void queryClient.invalidateQueries({ queryKey: DRAWS_KEY });
        },
    });
}
