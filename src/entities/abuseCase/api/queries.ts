import { keepPreviousData, useQuery } from '@tanstack/react-query';

import { apiClient } from '@shared/api/client';
import { envelopeSchema, pageSchema } from '@shared/api/envelopeSchema';
import { queryPresets } from '@shared/api/queryPresets';

import { abuseCaseDetailSchema, abuseCaseSchema } from '../model/types';

const abuseCasePageSchema = pageSchema(abuseCaseSchema);

export const ABUSE_CASES_KEY = ['admin', 'abuse-cases'] as const;

// 차단 내역 조회 엔드포인트 — spec AR01·AR02 (getddo-spec 05-api/abuse.md 채택 계약, 조회 전용)
export const ABUSE_CASES_API_PATH = '/v1/admin/abuse-cases';
export const abuseCaseApiPath = (caseId: string) => `${ABUSE_CASES_API_PATH}/${caseId}`;

export interface AbuseCasesParams {
    page: number;
    size: number;
    userId?: string;
    eventId?: string;
    sourceType?: string;
    from?: string;
    to?: string;
}

// 차단 내역은 추가만 되는 기록이라 표준 캐시로 충분하다 — 검토 결정처럼 덮어쓰는 값이 아니다
export function useAbuseCases(params: AbuseCasesParams) {
    return useQuery({
        ...queryPresets.standard,
        queryKey: [...ABUSE_CASES_KEY, 'list', params],
        placeholderData: keepPreviousData,
        queryFn: async () => {
            const { data } = await apiClient.get<unknown>(ABUSE_CASES_API_PATH, { params });
            return envelopeSchema(abuseCasePageSchema).parse(data).data;
        },
    });
}

export function useAbuseCase(caseId: string | null) {
    return useQuery({
        ...queryPresets.standard,
        queryKey: [...ABUSE_CASES_KEY, 'detail', caseId],
        queryFn: async () => {
            const { data } = await apiClient.get<unknown>(abuseCaseApiPath(caseId!));
            return envelopeSchema(abuseCaseDetailSchema).parse(data).data;
        },
        enabled: Boolean(caseId),
    });
}
