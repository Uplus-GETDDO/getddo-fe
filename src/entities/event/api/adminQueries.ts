import { keepPreviousData, useQueries, useQuery, useQueryClient } from '@tanstack/react-query';

import { apiClient } from '@shared/api/client';
import { envelopeSchema, pageSchema } from '@shared/api/envelopeSchema';
import { queryPresets } from '@shared/api/queryPresets';

import type { AdminEvent, AdminEventStatus, EventType } from '../model/adminTypes';

import { adminEventSchema } from '../model/adminTypes';

const adminEventPageSchema = pageSchema(adminEventSchema);

export const ADMIN_EVENTS_KEY = ['admin', 'events'] as const;

// 관리자 이벤트 엔드포인트 — AE01~AE08 (getddo-spec 05-api/event.md 초안)
export const ADMIN_EVENTS_API_PATH = '/v1/admin/events';
export const adminEventApiPath = (eventId: string) => `${ADMIN_EVENTS_API_PATH}/${eventId}`;

export interface AdminEventsParams {
    page: number;
    size: number;
    keyword?: string;
    status?: AdminEventStatus;
    eventType?: EventType;
    from?: string;
    to?: string;
    sort?: string;
    weightingEnabled?: boolean;
    createdFrom?: string;
    createdTo?: string;
}

// 관리자 목록·상태 운영은 가상 시계로 상태가 움직이므로 realtime 프리셋으로 서버 값을 따라간다
export function useAdminEvents(params: AdminEventsParams) {
    return useQuery({
        ...queryPresets.realtime,
        queryKey: [...ADMIN_EVENTS_KEY, 'list', params],
        // 필터·페이지를 바꿔 다시 받는 동안 이전 목록을 그대로 두어 표가 스켈레톤으로 꺼졌다 켜지지 않게 한다
        placeholderData: keepPreviousData,
        queryFn: async () => {
            const { data } = await apiClient.get<unknown>(ADMIN_EVENTS_API_PATH, { params });
            return envelopeSchema(adminEventPageSchema).parse(data).data;
        },
    });
}

export function useAdminEvent(eventId: string) {
    const queryClient = useQueryClient();
    return useQuery({
        ...queryPresets.realtime,
        queryKey: [...ADMIN_EVENTS_KEY, 'detail', eventId],
        // 목록에서 줄을 눌러 열 때는 목록에 이미 받은 같은 이벤트를 먼저 보여 준다 — 상세를 받는 동안 오른쪽 칸이
        // 스켈레톤으로 깜빡였다. 목록과 상세는 같은 스키마(AdminEvent)라 그대로 쓸 수 있고, 받은 뒤 상세로 바뀐다
        placeholderData: () => {
            for (const [, page] of queryClient.getQueriesData<{ items: AdminEvent[] }>({
                queryKey: [...ADMIN_EVENTS_KEY, 'list'],
            })) {
                const found = page?.items.find((event) => event.id === eventId);
                if (found) return found;
            }
            return undefined;
        },
        queryFn: async () => {
            const { data } = await apiClient.get<unknown>(adminEventApiPath(eventId));
            return envelopeSchema(adminEventSchema).parse(data).data;
        },
        enabled: Boolean(eventId),
    });
}

// 여러 상태의 목록을 한 번에 — AE01 상태 필터가 하나만 받아 상태마다 따로 불러 합친다 (추첨 관리의 단계 거르기).
// 키는 useAdminEvents와 같은 모양이라 같은 조건이면 캐시를 나눠 쓴다. truncated: 어느 상태든 한 쪽에 다 담기지 않았다
export function useAdminEventsByStatus(
    statuses: readonly AdminEventStatus[],
    params: Omit<AdminEventsParams, 'status'>,
) {
    return useQueries({
        queries: statuses.map((status) => {
            const query = { ...params, status };
            return {
                ...queryPresets.realtime,
                queryKey: [...ADMIN_EVENTS_KEY, 'list', query],
                placeholderData: keepPreviousData,
                queryFn: async () => {
                    const { data } = await apiClient.get<unknown>(ADMIN_EVENTS_API_PATH, {
                        params: query,
                    });
                    return envelopeSchema(adminEventPageSchema).parse(data).data;
                },
            };
        }),
        combine: (results) => ({
            items: results.flatMap((result) => result.data?.items ?? []),
            truncated: results.some(
                (result) => (result.data?.totalElements ?? 0) > (result.data?.items.length ?? 0),
            ),
            isPending: results.some((result) => result.isPending),
            isError: results.some((result) => result.isError),
        }),
    });
}

// 대시보드 집계 — 상태별 집계 API가 없어 상태마다 size=1로 불러 totalElements(전체 건수)만 쓴다
export function useAdminEventStatusCounts(statuses: readonly AdminEventStatus[]) {
    return useQueries({
        queries: statuses.map((status) => ({
            ...queryPresets.realtime,
            queryKey: [...ADMIN_EVENTS_KEY, 'count', status],
            queryFn: async () => {
                const { data } = await apiClient.get<unknown>(ADMIN_EVENTS_API_PATH, {
                    params: { page: 1, size: 1, status },
                });
                return envelopeSchema(adminEventPageSchema).parse(data).data.totalElements;
            },
        })),
        combine: (results) => ({
            counts: results.map((result) => result.data),
            isPending: results.some((result) => result.isPending),
            isError: results.some((result) => result.isError),
            refetch: () => results.forEach((result) => void result.refetch()),
        }),
    });
}
