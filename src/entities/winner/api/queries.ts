import { keepPreviousData, useQuery } from '@tanstack/react-query';

import { apiClient } from '@shared/api/client';
import { envelopeSchema, pageSchema } from '@shared/api/envelopeSchema';
import { queryPresets } from '@shared/api/queryPresets';

import { publicListChangeSchema } from '../model/types';

const publicListChangePageSchema = pageSchema(publicListChangeSchema);

export const RESULT_CHANGES_KEY = ['admin', 'result-changes'] as const;

// 당첨 취소·공개 반영 엔드포인트 — AD05·AD06·AD07 (getddo-spec 05-api/drawing.md 초안, 검토 대기)
export const winCancellationsApiPath = (winId: string) => `/v1/admin/wins/${winId}/cancellations`;
export const drawPublicationApiPath = (drawId: string) => `/v1/admin/draws/${drawId}/publication`;
export const eventResultChangesApiPath = (eventId: string) =>
    `/v1/admin/events/${eventId}/result-changes`;

// AD07 — 공개 명단 변경 이력(Page). 공개 반영(AD06)이 끝나면 무효화된다
export function useResultChanges(eventId: string, params: { page: number; size: number }) {
    return useQuery({
        ...queryPresets.standard,
        queryKey: [...RESULT_CHANGES_KEY, eventId, params],
        // 필터·페이지를 바꿔 다시 받는 동안 이전 목록을 그대로 두어 표가 스켈레톤으로 꺼졌다 켜지지 않게 한다
        placeholderData: keepPreviousData,
        queryFn: async () => {
            const { data } = await apiClient.get<unknown>(eventResultChangesApiPath(eventId), {
                params,
            });
            return envelopeSchema(publicListChangePageSchema).parse(data).data;
        },
        enabled: Boolean(eventId),
    });
}
