import { useInfiniteQuery, useQueries } from '@tanstack/react-query';

import { apiClient } from '@shared/api/client';
import { cursorSchema, envelopeSchema } from '@shared/api/envelopeSchema';

import type { TicketHistory, TicketOperationType } from '../model/history';

import { ticketHistorySchema } from '../model/history';
import { loadHistoryPage, type HistoryStream } from './historyPage';
import { TICKET_HISTORIES_API_PATH, TICKETS_KEY } from './queries';

const ticketHistoriesSchema = envelopeSchema(cursorSchema(ticketHistorySchema));

export interface TicketHistoryParams {
    size?: number;
    operationType?: TicketOperationType;
    operationTypes?: TicketOperationType[];
    from?: string;
    to?: string;
}

async function fetchTicketHistoryPage(
    params: Omit<TicketHistoryParams, 'operationTypes'> & { cursor?: string },
    signal: AbortSignal,
) {
    const { data } = await apiClient.get<unknown>(TICKET_HISTORIES_API_PATH, { params, signal });
    return ticketHistoriesSchema.parse(data).data;
}

/** T02 — 원시 이력 5건을 한 페이지로, 추가 조회는 사용자 조작으로만 실행한다. */
export function useTicketHistories({
    size = 5,
    operationType,
    operationTypes,
    from,
    to,
}: TicketHistoryParams = {}) {
    const types = operationTypes?.length ? [...new Set(operationTypes)].sort() : [operationType];
    const initialStreams: HistoryStream[] = types.map((type) => ({
        operationType: type,
        buffer: [],
        requestedCursors: [],
        ended: false,
    }));
    const query = useInfiniteQuery({
        queryKey: [
            ...TICKETS_KEY,
            'histories',
            'infinite',
            { size, operationTypes: types, from, to },
        ],
        initialPageParam: initialStreams,
        queryFn: ({ pageParam, signal }) =>
            loadHistoryPage(pageParam, size, (type, cursor) =>
                fetchTicketHistoryPage({ size, operationType: type, from, to, cursor }, signal),
            ),
        getNextPageParam: (lastPage) =>
            !lastPage.cursorError &&
            lastPage.streams.some((stream) => stream.buffer.length || !stream.ended)
                ? lastPage.streams
                : undefined,
        retry: false,
    });
    const unique = new Map<string, TicketHistory>();
    for (const page of query.data?.pages ?? []) {
        for (const item of page.items) {
            if (!unique.has(item.id)) unique.set(item.id, item);
        }
    }
    return {
        ...query,
        items: [...unique.values()],
        cursorError: query.data?.pages.some((page) => page.cursorError) ?? false,
    };
}

interface TicketHistoryCountParams {
    operationType: TicketOperationType;
    from: string;
    to: string;
}

/** 한 행당 한 장이라는 T02 계약에 따라 목록 로드 범위와 무관한 기간 전체 건수를 조회한다. */
export function useTicketHistoryCounts(paramsList: TicketHistoryCountParams[]) {
    return useQueries({
        queries: paramsList.map((params) => ({
            queryKey: [...TICKETS_KEY, 'histories', 'count', params],
            queryFn: async ({ signal }: { signal: AbortSignal }) =>
                (await fetchTicketHistoryPage({ ...params, size: 1 }, signal)).totalElements,
            retry: false,
        })),
        combine: (results) => ({
            counts: results.map((result) => result.data),
            isPending: results.some((result) => result.isPending),
            isError: results.some((result) => result.isError),
            isFetching: results.some((result) => result.isFetching),
            refetch: () => {
                results.forEach((result) => void result.refetch());
            },
        }),
    });
}
