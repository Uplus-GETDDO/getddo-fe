import type { Query } from '@tanstack/react-query';

import { useQueries, useQuery } from '@tanstack/react-query';

import { apiClient } from '@shared/api/client';
import { envelopeSchema, pageSchema } from '@shared/api/envelopeSchema';
import { queryPresets } from '@shared/api/queryPresets';

import type { DrawRunStatus, MyResult } from '../model/types';

import { isDrawRunInProgress } from '../model/runStatus';
import {
    drawCandidateSchema,
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
        queryKey: [...DRAW_RESULTS_KEY, eventId],
        enabled,
        queryFn: async () => {
            const { data } = await apiClient.get<unknown>(eventResultsApiPath(eventId));
            return envelopeSchema(publicResultsSchema).parse(data).data;
        },
        refetchInterval: (query) =>
            query.state.data?.isPublished ? false : queryPresets.realtime.refetchInterval,
    });
}

// getddo-spec 05-api/drawing.md E09 — 본인 결과 조회
export const eventMyResultApiPath = (eventId: string) => `/v1/events/${eventId}/my-result`;

/** 본인 결과 한 이벤트의 쿼리 설정 — 단건(useMyResult)과 여러 건(useMyResults)이 같은 캐시를 나눠 쓴다 */
const myResultOptions = (eventId: string) => ({
    ...queryPresets.realtime,
    queryKey: [...DRAW_RESULTS_KEY, eventId, 'me'],
    queryFn: async () => {
        const { data } = await apiClient.get<unknown>(eventMyResultApiPath(eventId));
        return envelopeSchema(myResultSchema).parse(data).data;
    },
    refetchInterval: (query: Query<MyResult>) =>
        query.state.data?.isPublished ? false : queryPresets.realtime.refetchInterval,
});

/**
 * 로그인한 본인의 이벤트 결과.
 *
 * 공개 명단(E08)에서 뒷자리로 찾아보는 것과 달리 서버가 본인 것만 바로 답한다.
 * 공개 전에는 PENDING으로 고정되므로, 공개 여부를 화면이 따로 판정하지 않는다.
 * 폴링 기준은 E08과 같다 — 공개된 뒤에는 멈춘다.
 */
export function useMyResult(eventId: string, enabled = true) {
    return useQuery({ ...myResultOptions(eventId), enabled });
}

/**
 * 내가 응모한 여러 이벤트의 본인 결과를 한꺼번에 받는다 (E09는 이벤트 단위라 이벤트마다 한 번씩).
 * 내 응모 내역·마이페이지에서 쓴다. 단건 조회와 캐시 키가 같아 상세 화면과 결과를 나눠 쓴다
 */
export function useMyResults(eventIds: readonly string[]) {
    return useQueries({ queries: eventIds.map((eventId) => myResultOptions(eventId)) });
}

// ── 관리자 추첨 관리(GD-125) ──
const drawRunPageSchema = pageSchema(drawRunSchema);
const drawCandidatePageSchema = pageSchema(drawCandidateSchema);
const drawVerificationPageSchema = pageSchema(drawVerificationSchema);

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

export interface PageParams {
    page: number;
    size: number;
}

// 서버가 선정하는 동안만 realtime 프리셋 주기로 폴링하고, 끝나면 멈춘다
const POLL_MS = queryPresets.realtime.refetchInterval;

// AD01 — 이벤트의 실행 목록(Page). 진행 중인 실행이 하나라도 있으면 폴링한다
export function useEventDraws(eventId: string, params: PageParams) {
    return useQuery({
        ...queryPresets.realtime,
        ...queryPresets.paged,
        refetchInterval: (query) =>
            query.state.data?.items.some((run) => isDrawRunInProgress(run.status))
                ? POLL_MS
                : false,
        queryKey: [...DRAWS_KEY, 'list', eventId, params],
        queryFn: async () => {
            const { data } = await apiClient.get<unknown>(eventDrawsApiPath(eventId), { params });
            return envelopeSchema(drawRunPageSchema).parse(data).data;
        },
        enabled: Boolean(eventId),
    });
}

async function fetchDrawRun(drawId: string) {
    const { data } = await apiClient.get<unknown>(drawApiPath(drawId));
    return envelopeSchema(drawRunDetailSchema).parse(data).data;
}

const drawRunOptions = (drawId: string | null) => ({
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
        ...queryPresets.paged,
        queryKey: [...DRAWS_KEY, 'participants', drawId, params],
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
        ...queryPresets.paged,
        queryKey: [...DRAWS_KEY, 'checks', drawId, params],
        queryFn: async () => {
            const { data } = await apiClient.get<unknown>(drawChecksApiPath(drawId!), { params });
            return envelopeSchema(drawVerificationPageSchema).parse(data).data;
        },
        enabled: Boolean(drawId),
    });
}
