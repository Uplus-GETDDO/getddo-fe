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

/** 서버가 허용하는 최대 페이지 크기 — 첫 페이지 한 번으로 지금 열린 미션을 덮는다 */
const LATEST_MISSIONS_SIZE = 100;

async function fetchMissionPage(page: number, size: number, signal: AbortSignal) {
    const { data } = await apiClient.get<unknown>(MISSIONS_API_PATH, {
        params: { page, size },
        signal,
    });
    return envelopeSchema(missionPageSchema).parse(data).data;
}

// 미션의 시작·종료 시각을 지나도 serverTime 기준 표시가 따라가도록 폴링한다
// passive observer는 같은 키의 소유자 폴링에 태운다 — 자체 주기는 걸지 않는다
const missionListInterval = (passive: boolean) =>
    passive ? false : (query: { state: { error: unknown } }) => pollingReadInterval(query);

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
 * 미션 수만큼 호출이 늘어나므로 전체 목록이 필요한 미션 보드만 쓴다 — 홈 계열은 useLatestMissions
 */
export function useMissionList({ passive = false }: { passive?: boolean } = {}) {
    return useQuery({
        ...queryPresets.standard,
        ...pollingReadPolicy,
        queryKey: [...MISSIONS_KEY, 'list'],
        refetchInterval: missionListInterval(passive),
        queryFn: (context) =>
            withPollingReadGuard(context, async () => {
                const missions: MissionSummary[] = [];
                for (let page = 1; ; page += 1) {
                    const parsed = await fetchMissionPage(page, MISSIONS_PAGE_SIZE, context.signal);
                    missions.push(...parsed.items);
                    if (missions.length >= parsed.totalElements || parsed.items.length === 0) break;
                }
                return missions;
            }),
    });
}

/**
 * 최근 미션 첫 페이지 한 번만 — 서버가 startsAt 내림차순이라 지금 열린 미션은 앞 페이지에 있다.
 * 홈 바로가기·적립 현황처럼 '오늘 열린 미션'만 보는 곳이 쓴다. 전체 목록과 키를 나눠 서로 덮어쓰지 않는다
 */
export function useLatestMissions({ passive = false }: { passive?: boolean } = {}) {
    return useQuery({
        ...queryPresets.standard,
        ...pollingReadPolicy,
        queryKey: [...MISSIONS_KEY, 'list', 'first'],
        refetchInterval: missionListInterval(passive),
        queryFn: (context) =>
            withPollingReadGuard(context, async () => {
                const parsed = await fetchMissionPage(1, LATEST_MISSIONS_SIZE, context.signal);
                return parsed.items;
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
