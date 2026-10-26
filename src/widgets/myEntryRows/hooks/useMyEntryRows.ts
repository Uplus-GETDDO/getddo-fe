import { useQueryClient } from '@tanstack/react-query';

import type { MyResult, MyResultStatus } from '@entities/drawResult';
import type { Entry } from '@entities/entry';
import type { Event } from '@entities/event';

import { DRAW_RESULTS_KEY, useMyResults } from '@entities/drawResult';
import { useMyEntries } from '@entities/entry';
import { useEventList } from '@entities/event';
import { getPollingRetryDelay } from '@shared/api/queryPresets';

import { groupEntryRows, type MyEntryGroup } from '../utils/groupEntryRows';

/** 응모(E06) + 이벤트(E01) + 본인 결과(E09) */
export interface MyEntryRow {
    entry: Entry;
    event: Event | undefined;
    isTimeRaffle: boolean;
    result: MyResultStatus | undefined;
    to: string;
}

interface Options {
    /** 화면의 필터·정렬·쪽 나누기 적용 후 실제 렌더링하는 줄(그룹) */
    selectVisibleGroups?: (groups: MyEntryGroup[]) => readonly MyEntryGroup[];
}

// 기본 필터는 받은 그룹을 그대로 둔다 — 기본값 화살표 함수를 모듈 상수로 둬 React Compiler가 적용되게 한다 (GD-347)
const allGroups = (groups: MyEntryGroup[]) => groups;

export function useMyEntryRows({ selectVisibleGroups = allGroups }: Options = {}) {
    const client = useQueryClient();
    const entriesQuery = useMyEntries();
    const { data: events } = useEventList();
    const entries = entriesQuery.data ?? [];
    const acceptedEventIds = [
        ...new Set(entries.filter((e) => e.status === 'ACCEPTED').map((e) => e.eventId)),
    ];
    const eventById = new Map((events ?? []).map((event) => [event.id, event]));
    const makeRows = (results: Map<string, MyResultStatus>): MyEntryRow[] =>
        entries
            .map((entry) => {
                const event = eventById.get(entry.eventId);
                const isTimeRaffle = event?.isTimeRaffle === true;
                return {
                    entry,
                    event,
                    isTimeRaffle,
                    result: entry.status === 'ACCEPTED' ? results.get(entry.eventId) : undefined,
                    to: `${isTimeRaffle ? '/time-raffle' : '/events'}/${entry.eventId}`,
                };
            })
            .sort(
                (a, b) =>
                    new Date(b.entry.requestedAt).getTime() -
                    new Date(a.entry.requestedAt).getTime(),
            );

    // 결과 필터도 폴링 범위에 반영한다. 아래 useMyResults가 같은 캐시의 변경을 구독한다.
    const cachedResults = new Map<string, MyResultStatus>();
    for (const eventId of acceptedEventIds) {
        const data = client.getQueryData<MyResult>([...DRAW_RESULTS_KEY, eventId, 'me']);
        if (data) cachedResults.set(eventId, data.result);
    }
    const pollingEventIds = [
        ...new Set(
            selectVisibleGroups(groupEntryRows(makeRows(cachedResults)))
                .filter((group) => group.status === 'ACCEPTED')
                .map((group) => group.eventId),
        ),
    ];
    const resultQueries = useMyResults(acceptedEventIds, pollingEventIds);
    const results = new Map<string, MyResultStatus>();
    resultQueries.forEach((query, index) => {
        const eventId = acceptedEventIds[index];
        if (eventId && query.data) results.set(eventId, query.data.result);
    });
    const rows = makeRows(results);
    const groups = groupEntryRows(rows);
    const successTimes = resultQueries
        .filter((query) => query.data)
        .map((query) => query.dataUpdatedAt);
    const isResultPending = resultQueries.some((query) => query.isPending);
    return {
        rows,
        groups,
        isPending: entriesQuery.isPending && !entriesQuery.data,
        isError: entriesQuery.isError && !entriesQuery.data,
        isEntriesRefreshError: entriesQuery.isError && Boolean(entriesQuery.data),
        isResultPending,
        isRateLimited: resultQueries.some(
            (query) => getPollingRetryDelay(query.error ?? query.failureReason) > 0,
        ),
        isResultError: resultQueries.some((query) => query.isError),
        isResultInitialError: resultQueries.some((query) => query.isError && !query.data),
        isResultRefreshError: resultQueries.some((query) => query.isError && Boolean(query.data)),
        isFetching: entriesQuery.isFetching || resultQueries.some((query) => query.isFetching),
        oldestResultUpdatedAt: successTimes.length ? Math.min(...successTimes) : undefined,
        refetch: () =>
            Promise.all([entriesQuery.refetch(), ...resultQueries.map((query) => query.refetch())]),
    };
}
