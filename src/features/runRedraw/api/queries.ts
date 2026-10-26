import { useMutation, useQueryClient } from '@tanstack/react-query';

import {
    cancellationRedrawsApiPath,
    DRAW_RESULTS_KEY,
    DRAWS_KEY,
    drawExecutionResponseSchema,
} from '@entities/drawResult';
import {
    drawPublicationApiPath,
    publicationUpdateResultSchema,
    RESULT_CHANGES_KEY,
} from '@entities/winner';
import { apiClient } from '@shared/api/client';
import { envelopeSchema } from '@shared/api/envelopeSchema';

// AD09 — 취소에 연결된 재추첨 실행의 시작·재개. 응답은 DrawExecutionResponse(runId·status·confirmation)이고,
// 이미 확정된 실행은 서버가 저장 결과를 돌려준다(200).
// 취소·재추첨 쌍의 멱등은 취소 ID로 서버가 보장해 별도 멱등 헤더가 없다 (common.md 중복 요청 표)
export function useStartRedraw() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (cancellationId: string) => {
            const { data } = await apiClient.post<unknown>(
                cancellationRedrawsApiPath(cancellationId),
            );
            return envelopeSchema(drawExecutionResponseSchema).parse(data).data;
        },
        onSuccess: () => {
            void queryClient.invalidateQueries({ queryKey: DRAWS_KEY });
        },
    });
}

// AD06 — 당첨자 공개 이후 확정된 재추첨 결과로 공개 명단을 갱신한다.
// 요청 본문이 없는 계약이라 갱신 사유는 서버가 연결된 취소의 사유를 쓴다 (05-api/drawing.md AD06).
// 최초 공개 전 재추첨의 확인 API는 후속 계약이라 이 훅을 최초 공개 전에 호출하지 않는다 (호출부가 막는다)
export function usePublishRedraw() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (drawId: string) => {
            const { data } = await apiClient.post<unknown>(drawPublicationApiPath(drawId));
            return envelopeSchema(publicationUpdateResultSchema).parse(data).data;
        },
        onSuccess: () => {
            // 결과의 공개 이력(wasPublished)과 변경 이력이 함께 바뀐다
            void queryClient.invalidateQueries({ queryKey: DRAWS_KEY });
            void queryClient.invalidateQueries({ queryKey: RESULT_CHANGES_KEY });
            // 공개 명단이 바뀌었으므로 사용자용 공개 결과(E08)도 다시 받는다 — 관리자 키(DRAWS_KEY)와는 별개 캐시다
            void queryClient.invalidateQueries({ queryKey: DRAW_RESULTS_KEY });
        },
    });
}
