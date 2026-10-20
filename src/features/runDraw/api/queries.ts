import { useMutation, useQueryClient } from '@tanstack/react-query';

import {
    DRAWS_KEY,
    DRAW_RESULTS_KEY,
    drawChecksApiPath,
    drawExecutionResponseSchema,
    drawResultConfirmationApiPath,
    drawResultConfirmationSchema,
    drawResumeApiPath,
    drawVerificationSchema,
} from '@entities/drawResult';
import { ADMIN_EVENTS_KEY } from '@entities/event';
import {
    awardCancellationResultSchema,
    RESULT_CHANGES_KEY,
    winCancellationsApiPath,
} from '@entities/winner';
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

/**
 * GD-199 — 최신 검토 실행의 최종 확인과 최초 공개를 한 요청으로 처리한다.
 * 본문·추가 멱등 헤더 없이 최신 검토 runId 하나만 보낸다. 최초 공개 전에는
 * AD06(publication)을 연달아 호출하지 않으며, 확인 버튼과 발표를 분리하지 않는다.
 * 성공 응답의 isPublished=false를 공개 완료로 해석하지 않는다 — 최초 발표의
 * 정상 성공은 isPublished=true다.
 */
export function useConfirmResult() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (runId: string) => {
            const { data } = await apiClient.post<unknown>(drawResultConfirmationApiPath(runId));
            return envelopeSchema(drawResultConfirmationSchema).parse(data).data;
        },
        onSuccess: () => {
            // 최초 공개로 실행 상세·변경 이력·공개 결과·이벤트 상태(PUBLISHED)가 함께 바뀐다
            void queryClient.invalidateQueries({ queryKey: DRAWS_KEY });
            void queryClient.invalidateQueries({ queryKey: RESULT_CHANGES_KEY });
            void queryClient.invalidateQueries({ queryKey: DRAW_RESULTS_KEY });
            void queryClient.invalidateQueries({ queryKey: ADMIN_EVENTS_KEY });
        },
        onError: () => {
            // 명단 변경 거절(PUBLICATION-005) 등 검토 시점과 다른 상태일 수 있으니 실행 목록을 새로 받는다
            void queryClient.invalidateQueries({ queryKey: DRAWS_KEY });
        },
    });
}
