import type { Query, QueryFunctionContext } from '@tanstack/react-query';

import { keepPreviousData, useQueries, useQuery } from '@tanstack/react-query';

import { apiClient } from '@shared/api/client';
import { envelopeSchema, pageSchema } from '@shared/api/envelopeSchema';
import {
    queryPresets,
    pollingReadPolicy,
    pollingReadInterval,
    withPollingReadGuard,
} from '@shared/api/queryPresets';

import type { DrawRunStatus, MyResult } from '../model/types';

import { isDrawRunInProgress } from '../model/runStatus';
import {
    drawCandidateSchema,
    drawExecutionAuditSchema,
    drawFailureSchema,
    drawRunDetailSchema,
    drawRunSchema,
    drawVerificationSchema,
    myResultSchema,
    publicResultsSchema,
} from '../model/types';

export const DRAW_RESULTS_KEY = ['draw-results'] as const;

// getddo-spec 05-api/drawing.md E08 — 공개 결과 조회
export const eventResultsApiPath = (eventId: string) => `/v1/events/${eventId}/results`;

/**
 * 이벤트의 공개 추첨 결과.
 *
 * 발표가 지연될 수 있어 예정 시각이 지나도 공개 전일 수 있다. 그래서 공개 전에는 계속
 * 따라가다가, 공개된 뒤에는 폴링을 멈춘다 — 결과는 revision이 바뀔 때만 달라진다.
 */
export function useEventResults(eventId: string, enabled = true) {
    return useQuery({
        ...queryPresets.realtime,
        ...pollingReadPolicy,
        queryKey: [...DRAW_RESULTS_KEY, eventId],
        enabled,
        queryFn: (context) =>
            withPollingReadGuard(context, async () => {
                const { data } = await apiClient.get<unknown>(eventResultsApiPath(eventId), {
                    signal: context.signal,
                });
                return envelopeSchema(publicResultsSchema).parse(data).data;
            }),
        refetchInterval: (query) =>
            pollingReadInterval(
                query,
                !query.state.data?.isPublished &&
                    !['CANCELED', 'NO_ENTRANTS'].includes(query.state.data?.displayStatus ?? ''),
            ),
    });
}

// getddo-spec 05-api/drawing.md E09 — 본인 결과 조회
export const eventMyResultApiPath = (eventId: string) => `/v1/events/${eventId}/my-result`;

/** 단건과 다건은 같은 캐시를 공유한다. CANCELED만으로 종결 여부를 추측하지 않는다. */
const myResultOptions = (eventId: string, polling = true) => ({
    ...queryPresets.realtime,
    ...pollingReadPolicy,
    queryKey: [...DRAW_RESULTS_KEY, eventId, 'me'],
    queryFn: (context: QueryFunctionContext) =>
        withPollingReadGuard(context, async () => {
            const { data } = await apiClient.get<unknown>(eventMyResultApiPath(eventId), {
                signal: context.signal,
            });
            return envelopeSchema(myResultSchema).parse(data).data;
        }),
    refetchInterval: (query: Query<MyResult>) =>
        pollingReadInterval(query, polling && !query.state.data?.isPublished),
});

export function useMyResult(eventId: string, enabled = true) {
    return useQuery({ ...myResultOptions(eventId), enabled });
}

/** 최초 전체 집계 조회를 유지하고, 후속 주기 조회만 화면에 표시된 이벤트로 제한한다. */
export function useMyResults(
    eventIds: readonly string[],
    pollingEventIds: readonly string[] = eventIds,
) {
    const pollingIds = new Set(pollingEventIds);
    return useQueries({
        queries: [...new Set(eventIds)].map((eventId) => ({
            ...myResultOptions(eventId, pollingIds.has(eventId)),
            // 숨긴 결과의 전체 집계는 화면 복귀·네트워크 복구 때 자동으로 다시 읽지 않는다.
            refetchOnMount: false,
            retryOnMount: false,
            refetchOnReconnect: false,
        })),
    });
}
// ── 관리자 추첨 관리(GD-125) ──
const drawRunPageSchema = pageSchema(drawRunSchema);
const drawCandidatePageSchema = pageSchema(drawCandidateSchema);
const drawVerificationPageSchema = pageSchema(drawVerificationSchema);
const drawFailurePageSchema = pageSchema(drawFailureSchema);
const drawExecutionAuditPageSchema = pageSchema(drawExecutionAuditSchema);

export const DRAWS_KEY = ['admin', 'draws'] as const;

// 추첨 엔드포인트 — AD01~AD04·AD08·AD09, 최초 재개 (getddo-spec 05-api/drawing.md 초안, 검토 대기)
export const eventDrawsApiPath = (eventId: string) => `/v1/admin/events/${eventId}/draws`;
export const drawApiPath = (drawId: string) => `/v1/admin/draws/${drawId}`;
export const drawParticipantsApiPath = (drawId: string) => `${drawApiPath(drawId)}/participants`;
// AD04(검증 실행)와 AD08(검증 이력)은 같은 경로를 메서드로 나눈다
export const drawChecksApiPath = (drawId: string) => `${drawApiPath(drawId)}/checks`;
// GD-87 최초 추첨 실패 재개 — 실패한 기존 INITIAL 실행을 이어서 진행한다 (새 실행을 만들지 않는다)
export const drawResumeApiPath = (runId: string) => `${drawApiPath(runId)}/resume`;
export const cancellationRedrawsApiPath = (cancellationId: string) =>
    `/v1/admin/cancellations/${cancellationId}/redraws`;
// GD-137 관리자 운영 이력 — 실행별 실패 이력·실행 감사. 공통 감사 조회와 다른 업무별 경로다
export const drawFailuresApiPath = (drawId: string) => `${drawApiPath(drawId)}/failures`;
export const drawExecutionAuditsApiPath = (drawId: string) =>
    `${drawApiPath(drawId)}/execution-audits`;
// GD-199 — 최신 검토 실행의 최종 확인과 최초 공개를 한 요청으로 처리한다 (본문·추가 멱등 헤더 없음)
export const drawResultConfirmationApiPath = (runId: string) =>
    `${drawApiPath(runId)}/result-confirmation`;

export interface PageParams {
    page: number;
    size: number;
}

// 서버가 선정하는 동안만 realtime 프리셋 주기로 폴링하고, 끝나면 멈춘다
const POLL_MS = queryPresets.realtime.refetchInterval;

// AD01 단일 페이지 fetch — 취소 원본 결과를 찾기 위한 이전 페이지 순차 탐색에서도 쓴다
export async function fetchEventDrawsPage(eventId: string, params: PageParams) {
    const { data } = await apiClient.get<unknown>(eventDrawsApiPath(eventId), { params });
    return envelopeSchema(drawRunPageSchema).parse(data).data;
}

// AD01 — 이벤트의 실행 목록(Page). 진행 중인 실행이 하나라도 있으면 폴링한다
export function useEventDraws(eventId: string, params: PageParams) {
    return useQuery({
        ...queryPresets.realtime,
        refetchInterval: (query) =>
            query.state.data?.items.some((run) => isDrawRunInProgress(run.status))
                ? POLL_MS
                : false,
        queryKey: [...DRAWS_KEY, 'list', eventId, params],
        // 필터·페이지를 바꿔 다시 받는 동안 이전 목록을 그대로 두어 표가 스켈레톤으로 꺼졌다 켜지지 않게 한다
        placeholderData: keepPreviousData,
        queryFn: () => fetchEventDrawsPage(eventId, params),
        enabled: Boolean(eventId),
    });
}

async function fetchDrawRun(drawId: string) {
    const { data } = await apiClient.get<unknown>(drawApiPath(drawId));
    return envelopeSchema(drawRunDetailSchema).parse(data).data;
}

// fetchQuery에서도 같은 키·fetcher를 써야 상세 캐시를 공유한다 — 화면 밖 탐색용으로 export한다
export const drawRunOptions = (drawId: string | null) => ({
    ...queryPresets.realtime,
    refetchInterval: (query: { state: { data?: { status: DrawRunStatus } } }) =>
        query.state.data && isDrawRunInProgress(query.state.data.status) ? POLL_MS : false,
    queryKey: [...DRAWS_KEY, 'detail', drawId],
    queryFn: () => fetchDrawRun(drawId!),
    enabled: Boolean(drawId),
});

// AD02 — 실행 상세
export function useDrawRun(drawId: string | null) {
    return useQuery(drawRunOptions(drawId));
}

// 여러 실행의 상세를 한 번에 — 재추첨이 취소한 원본 결과의 공개 이력을 확인할 때 쓴다
export function useDrawRuns(drawIds: string[]) {
    return useQueries({ queries: drawIds.map((id) => drawRunOptions(id)) });
}

// AD03 — 해당 실행이 실제 사용한 후보 명단. 실행 시점에 고정된 스냅샷이다
export function useDrawCandidates(drawId: string | null, params: PageParams) {
    return useQuery({
        ...queryPresets.standard,
        queryKey: [...DRAWS_KEY, 'participants', drawId, params],
        placeholderData: keepPreviousData,
        queryFn: async () => {
            const { data } = await apiClient.get<unknown>(drawParticipantsApiPath(drawId!), {
                params,
            });
            return envelopeSchema(drawCandidatePageSchema).parse(data).data;
        },
        enabled: Boolean(drawId),
    });
}

// AD08 — 정합성 검증 이력. 검증 실행(AD04) 직후 무효화돼 새 이력이 바로 보인다
export function useDrawVerifications(drawId: string | null, params: PageParams) {
    return useQuery({
        ...queryPresets.standard,
        queryKey: [...DRAWS_KEY, 'checks', drawId, params],
        placeholderData: keepPreviousData,
        queryFn: async () => {
            const { data } = await apiClient.get<unknown>(drawChecksApiPath(drawId!), { params });
            return envelopeSchema(drawVerificationPageSchema).parse(data).data;
        },
        enabled: Boolean(drawId),
    });
}

// GD-137 — 실행의 전체 실패 이력 (failedAt·id 내림차순은 서버 정렬). 추가만 되는 기록이다
export function useDrawFailures(drawId: string | null, params: PageParams) {
    return useQuery({
        ...queryPresets.standard,
        queryKey: [...DRAWS_KEY, 'failures', drawId, params],
        placeholderData: keepPreviousData,
        queryFn: async () => {
            const { data } = await apiClient.get<unknown>(drawFailuresApiPath(drawId!), {
                params,
            });
            return envelopeSchema(drawFailurePageSchema).parse(data).data;
        },
        enabled: Boolean(drawId),
    });
}

// GD-137 — 실행의 시작·재개·취소 등 업무 감사 이력 (createdAt·id 내림차순은 서버 정렬)
export function useDrawExecutionAudits(drawId: string | null, params: PageParams) {
    return useQuery({
        ...queryPresets.standard,
        queryKey: [...DRAWS_KEY, 'execution-audits', drawId, params],
        placeholderData: keepPreviousData,
        queryFn: async () => {
            const { data } = await apiClient.get<unknown>(drawExecutionAuditsApiPath(drawId!), {
                params,
            });
            return envelopeSchema(drawExecutionAuditPageSchema).parse(data).data;
        },
        enabled: Boolean(drawId),
    });
}
