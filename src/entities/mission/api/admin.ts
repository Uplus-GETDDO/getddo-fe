import { useQuery } from '@tanstack/react-query';

import { apiClient } from '@shared/api/client';
import { envelopeSchema, pageSchema } from '@shared/api/envelopeSchema';
import { pollingReadPolicy, withPollingReadGuard } from '@shared/api/queryPresets';

import {
    adminMissionSchema,
    adminMissionSummarySchema,
    surveyRangeSchema,
    surveySummarySchema,
} from '../model/adminTypes';

export const ADMIN_MISSIONS_KEY = ['adminMissions'] as const;
export const ADMIN_MISSIONS_PATH = '/v1/admin/missions';
export interface AdminMissionsParams {
    page: number;
    missionType?: 'QUIZ' | 'SURVEY';
    status?: 'ACTIVE' | 'ENDED';
    keyword?: string;
    from?: string;
    to?: string;
}
export function useAdminMissions(params: AdminMissionsParams) {
    return useQuery({
        ...pollingReadPolicy,
        queryKey: [...ADMIN_MISSIONS_KEY, 'list', params],
        queryFn: (context) =>
            withPollingReadGuard(context, async () => {
                const { data } = await apiClient.get<unknown>(ADMIN_MISSIONS_PATH, {
                    params: { ...params, size: 20 },
                    signal: context.signal,
                });
                return envelopeSchema(pageSchema(adminMissionSummarySchema)).parse(data).data;
            }),
    });
}
export function useAdminMission(id: string | null) {
    return useQuery({
        ...pollingReadPolicy,
        queryKey: [...ADMIN_MISSIONS_KEY, 'detail', id],
        enabled: !!id,
        queryFn: (context) =>
            withPollingReadGuard(context, async () => {
                const { data } = await apiClient.get<unknown>(`${ADMIN_MISSIONS_PATH}/${id}`, {
                    signal: context.signal,
                });
                return envelopeSchema(adminMissionSchema).parse(data).data;
            }),
    });
}
export function useSurveySummary(id: string, range: { from: string; to: string } | null) {
    return useQuery({
        ...pollingReadPolicy,
        queryKey: [...ADMIN_MISSIONS_KEY, 'survey', id, range],
        enabled: !!range,
        queryFn: (context) =>
            withPollingReadGuard(context, async () => {
                const params = surveyRangeSchema.parse(range);
                const { data } = await apiClient.get<unknown>(
                    `${ADMIN_MISSIONS_PATH}/${id}/survey-summary`,
                    { params, signal: context.signal },
                );
                return envelopeSchema(surveySummarySchema).parse(data).data;
            }),
    });
}
