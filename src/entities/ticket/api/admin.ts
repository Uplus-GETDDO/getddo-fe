import { useQueries, useQuery } from '@tanstack/react-query';

import { apiClient } from '@shared/api/client';
import { envelopeSchema, pageSchema } from '@shared/api/envelopeSchema';
import { queryPresets } from '@shared/api/queryPresets';

import {
    adminTicketHistorySchema,
    ticketConsistencySchema,
    ticketGrantSchema,
    ticketInconsistencySchema,
    ticketRefundSchema,
} from '../model/admin';

export const ADMIN_TICKETS_KEY = ['admin', 'tickets'] as const;

// 관리자 응모권 조회 엔드포인트 — 2026-10-12 백엔드 답변 기준(스펙 미반영). 경로가 바뀌면 여기만 고친다
export const ADMIN_TICKET_GRANTS_API_PATH = '/v1/admin/ticket-grants';
export const ADMIN_TICKET_HISTORIES_API_PATH = '/v1/admin/ticket-histories';
export const ADMIN_TICKET_REFUNDS_API_PATH = '/v1/admin/ticket-refunds';
export const ADMIN_TICKET_INCONSISTENCIES_API_PATH = '/v1/admin/tickets/inconsistencies';
export const ticketConsistencyApiPath = (userId: string) =>
    `/v1/admin/users/${encodeURIComponent(userId)}/tickets/consistency`;

interface PageParams {
    page: number;
    size: number;
}

export interface AdminTicketGrantsParams extends PageParams {
    userId?: string;
    keyword?: string;
    missionId?: string;
    sourceType?: string;
    grade?: string;
    from?: string;
    to?: string;
}

export interface AdminTicketHistoriesParams extends PageParams {
    userId?: string;
    eventId?: string;
    missionId?: string;
    operationType?: string;
    from?: string;
    to?: string;
}

export interface AdminTicketRefundsParams extends PageParams {
    eventId?: string;
    userId?: string;
    from?: string;
    to?: string;
}

export interface TicketInconsistenciesParams extends PageParams {
    userId?: string;
}

// 정합성은 요청 시점에 계산한 값이라 캐시하지 않고 화면에 들어올 때마다 새로 받는다.
// 페이지·필터를 바꾸면 새 결과가 올 때까지 이전 목록을 두고, 화면의 새로고침 표시로 받는 중임을 알린다
const adminListOptions = {
    ...queryPresets.noCache,
    ...queryPresets.paged,
} as const;

// AO03 — 지급 이력
export function useAdminTicketGrants(params: AdminTicketGrantsParams) {
    return useQuery({
        ...adminListOptions,
        queryKey: [...ADMIN_TICKETS_KEY, 'grants', params],
        queryFn: async () => {
            const { data } = await apiClient.get<unknown>(ADMIN_TICKET_GRANTS_API_PATH, { params });
            return envelopeSchema(pageSchema(ticketGrantSchema)).parse(data).data;
        },
    });
}

// AO05 — 전체 이력. 서랍처럼 조건부로 쓰는 호출은 enabled로 끈다
export function useAdminTicketHistories(
    params: AdminTicketHistoriesParams,
    options: { enabled?: boolean } = {},
) {
    return useQuery({
        ...adminListOptions,
        queryKey: [...ADMIN_TICKETS_KEY, 'histories', params],
        enabled: options.enabled ?? true,
        queryFn: async () => {
            const { data } = await apiClient.get<unknown>(ADMIN_TICKET_HISTORIES_API_PATH, {
                params,
            });
            return envelopeSchema(pageSchema(adminTicketHistorySchema)).parse(data).data;
        },
    });
}

// AO08 — 반환 이력
export function useAdminTicketRefunds(params: AdminTicketRefundsParams) {
    return useQuery({
        ...adminListOptions,
        queryKey: [...ADMIN_TICKETS_KEY, 'refunds', params],
        queryFn: async () => {
            const { data } = await apiClient.get<unknown>(ADMIN_TICKET_REFUNDS_API_PATH, {
                params,
            });
            return envelopeSchema(pageSchema(ticketRefundSchema)).parse(data).data;
        },
    });
}

// AO09 — 전체 불일치 목록
export function useTicketInconsistencies(params: TicketInconsistenciesParams) {
    return useQuery({
        ...adminListOptions,
        queryKey: [...ADMIN_TICKETS_KEY, 'inconsistencies', params],
        queryFn: async () => {
            const { data } = await apiClient.get<unknown>(ADMIN_TICKET_INCONSISTENCIES_API_PATH, {
                params,
            });
            return envelopeSchema(pageSchema(ticketInconsistencySchema)).parse(data).data;
        },
    });
}

// AO04 — 사용자별 정합성. userId가 없으면 호출하지 않는다 (404는 호출부가 오류로 받아 안내한다)
export function useTicketConsistency(userId: string | null) {
    return useQuery({
        ...queryPresets.noCache,
        queryKey: [...ADMIN_TICKETS_KEY, 'consistency', userId],
        enabled: Boolean(userId),
        retry: false,
        queryFn: async () => {
            const { data } = await apiClient.get<unknown>(ticketConsistencyApiPath(userId!));
            return envelopeSchema(ticketConsistencySchema).parse(data).data;
        },
    });
}

type CountParams<T> = Omit<T, 'page' | 'size'>;

/** 조건별 건수 묶음 — 순서는 넘긴 조건 순서와 같다. 하나라도 실패하면 isError */
export interface AdminTicketCounts {
    counts: (number | undefined)[];
    isPending: boolean;
    isError: boolean;
    refetch: () => void;
}

// 대시보드 집계 — 일별·출처별 집계 API가 아직 없어 조건마다 size=1로 불러 totalElements(전체 건수)만 쓴다.
// 조건 수만큼 요청이 나가므로 기간을 짧게(최대 14일) 쓴다. 집계 API가 생기면 이 두 훅만 바꾼다
const COUNT_STALE_MS = 60_000;

const combineCounts = (
    results: { data?: number; isPending: boolean; isError: boolean; refetch: () => unknown }[],
): AdminTicketCounts => ({
    counts: results.map((result) => result.data),
    isPending: results.some((result) => result.isPending),
    isError: results.some((result) => result.isError),
    refetch: () => results.forEach((result) => void result.refetch()),
});

/** AO03 지급 건수 — 조건마다 한 장씩 센 지급 응모권 수 */
export function useAdminTicketGrantCounts(
    paramsList: CountParams<AdminTicketGrantsParams>[],
): AdminTicketCounts {
    return useQueries({
        queries: paramsList.map((params) => ({
            queryKey: [...ADMIN_TICKETS_KEY, 'grants', 'count', params],
            staleTime: COUNT_STALE_MS,
            queryFn: async () => {
                const { data } = await apiClient.get<unknown>(ADMIN_TICKET_GRANTS_API_PATH, {
                    params: { ...params, page: 1, size: 1 },
                });
                return envelopeSchema(pageSchema(ticketGrantSchema)).parse(data).data.totalElements;
            },
        })),
        combine: combineCounts,
    });
}

/** AO05 이력 건수 — 예: operationType=USE로 응모에 쓴 응모권 수 */
export function useAdminTicketHistoryCounts(
    paramsList: CountParams<AdminTicketHistoriesParams>[],
): AdminTicketCounts {
    return useQueries({
        queries: paramsList.map((params) => ({
            queryKey: [...ADMIN_TICKETS_KEY, 'histories', 'count', params],
            staleTime: COUNT_STALE_MS,
            queryFn: async () => {
                const { data } = await apiClient.get<unknown>(ADMIN_TICKET_HISTORIES_API_PATH, {
                    params: { ...params, page: 1, size: 1 },
                });
                return envelopeSchema(pageSchema(adminTicketHistorySchema)).parse(data).data
                    .totalElements;
            },
        })),
        combine: combineCounts,
    });
}
