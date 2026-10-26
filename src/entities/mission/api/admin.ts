import { keepPreviousData, useQuery } from '@tanstack/react-query';

import { apiClient } from '@shared/api/client';
import { envelopeSchema, pageSchema } from '@shared/api/envelopeSchema';
import { pollingReadPolicy, withPollingReadGuard } from '@shared/api/queryPresets';

import {
    adminMissionSchema,
    adminMissionSummarySchema,
    surveyFreeTextAnswerSchema,
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
        // 필터·페이지를 바꿔 다시 받는 동안 이전 목록을 그대로 두어 표가 스켈레톤으로 꺼졌다 켜지지 않게 한다
        placeholderData: keepPreviousData,
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
/**
 * AM05 설문 자유 서술 답변 — questionId는 이 미션의 FREE_TEXT 문항이어야 한다.
 * 기간 규칙은 집계(AM04)와 같고 완료된 제출만 최신순으로 온다
 */
export function useSurveyAnswers(
    missionId: string,
    questionId: string | null,
    range: { from: string; to: string } | null,
    page: number,
) {
    return useQuery({
        ...pollingReadPolicy,
        queryKey: [...ADMIN_MISSIONS_KEY, 'surveyAnswers', missionId, questionId, range, page],
        placeholderData: keepPreviousData,
        enabled: !!questionId && !!range,
        queryFn: (context) =>
            withPollingReadGuard(context, async () => {
                const params = surveyRangeSchema.parse(range);
                const { data } = await apiClient.get<unknown>(
                    `${ADMIN_MISSIONS_PATH}/${missionId}/survey-answers`,
                    {
                        params: { questionId, ...params, page, size: 20 },
                        signal: context.signal,
                    },
                );
                return envelopeSchema(pageSchema(surveyFreeTextAnswerSchema)).parse(data).data;
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
