import { useQuery } from '@tanstack/react-query';

import { apiClient } from '@shared/api/client';
import { envelopeSchema, pageSchema } from '@shared/api/envelopeSchema';
import {
    pollingReadInterval,
    pollingReadPolicy,
    queryPresets,
    withPollingReadGuard,
} from '@shared/api/queryPresets';

import type { MissionSummary } from '../model/types';
import type { MissionSubmissionResult } from '../model/types';

import { missionDetailSchema, missionSummarySchema } from '../model/types';

const missionPageSchema = pageSchema(missionSummarySchema);

export const MISSIONS_KEY = ['missions'] as const;

export const MISSIONS_API_PATH = '/v1/missions';

export const missionApiPath = (missionId: string) => `${MISSIONS_API_PATH}/${missionId}`;

const MISSIONS_PAGE_SIZE = 50;

/**
 * 제출 응답 + 신규 완료 여부. 서버는 이미 완료된 미션의 재제출에 200으로 기존 결과를 돌려주고,
 * 이번 제출로 막 완료됐을 때만 201을 준다 — 보상 모달 같은 "방금 완료" 연출은 201에만 띄운다
 */
export interface MissionSubmissionOutcome {
    result: MissionSubmissionResult;
    isNewSubmission: boolean;
}

/**
 * 진행 중인 미션 목록 — Page<T>는 기본 20건씩이라 totalElements까지 전부 모은다.
 * 제출이 완료되면 features/submit-survey·submit-quiz가 이 쿼리를 무효화한다.
 */
export function useMissionList() {
    return useQuery({
        ...queryPresets.standard,
        ...pollingReadPolicy,
        queryKey: [...MISSIONS_KEY, 'list'],
        // 화면이 열린 채 미션의 시작·종료 시각을 지나도 serverTime 기준 표시가 따라가도록 폴링한다
        refetchInterval: (query: { state: { error: unknown } }) => pollingReadInterval(query),
        queryFn: (context) =>
            withPollingReadGuard(context, async () => {
                const missions: MissionSummary[] = [];
                for (let page = 1; ; page += 1) {
                    const { data } = await apiClient.get<unknown>(MISSIONS_API_PATH, {
                        params: { page, size: MISSIONS_PAGE_SIZE },
                        signal: context.signal,
                    });
                    const parsed = envelopeSchema(missionPageSchema).parse(data).data;
                    missions.push(...parsed.items);
                    if (missions.length >= parsed.totalElements || parsed.items.length === 0) break;
                }
                return missions;
            }),
    });
}

/**
 * 미션 상세 — 문항·선택지 포함. 정답 필드는 계약상 응답에 없다 (M02).
 * enabled: 목록 카드처럼 필요한 미션만 미리 불러올 때 끈다 (기본 켜짐)
 */
export function useMissionDetail(
    missionId: string,
    { enabled = true }: { enabled?: boolean } = {},
) {
    return useQuery({
        ...queryPresets.standard,
        ...pollingReadPolicy,
        enabled,
        queryKey: [...MISSIONS_KEY, 'detail', missionId],
        queryFn: (context) =>
            withPollingReadGuard(context, async () => {
                const { data } = await apiClient.get<unknown>(missionApiPath(missionId), {
                    signal: context.signal,
                });
                return envelopeSchema(missionDetailSchema).parse(data).data;
            }),
    });
}
