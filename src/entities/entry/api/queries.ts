import { useQueries, useQuery } from '@tanstack/react-query';
import { z } from 'zod';

import { apiClient } from '@shared/api/client';
import { envelopeSchema } from '@shared/api/envelopeSchema';
import {
    pollingReadInterval,
    pollingReadPolicy,
    queryPresets,
    withPollingReadGuard,
} from '@shared/api/queryPresets';

import type { EntryStatistics } from '../model/types';

import { entryEligibilitySchema, entrySchema, entryStatisticsSchema } from '../model/types';

// spec 공통 계약 초안의 Page<T> 봉투 — items/page/size/totalElements (페이지는 1부터)
const myEntryPageSchema = z.object({
    items: z.array(entrySchema),
    page: z.number().int(),
    size: z.number().int(),
    totalElements: z.number().int(),
});

export const ENTRIES_KEY = ['entries'] as const;

export const MY_ENTRIES_API_PATH = '/v1/users/me/entries';

const ENTRIES_PAGE_SIZE = 50;

// Page<Entry>는 기본 20건씩이라 totalElements까지 전부 모아야 합계·목록이 정확하다 (페이지는 1부터)
const fetchAllMyEntries = async (
    signal: AbortSignal,
    filter: { eventId?: string; status?: 'ACCEPTED' | 'REJECTED' } = {},
) => {
    const entries = [];
    for (let page = 1; ; page += 1) {
        const { data } = await apiClient.get<unknown>(MY_ENTRIES_API_PATH, {
            params: { page, size: ENTRIES_PAGE_SIZE, ...filter },
            signal,
        });
        const parsed = envelopeSchema(myEntryPageSchema).parse(data).data;
        entries.push(...parsed.items);
        if (entries.length >= parsed.totalElements) break;
        if (parsed.items.length === 0)
            throw new Error('응모 전체 내역을 받지 못했습니다. 다시 조회해 주세요.');
    }
    return entries;
};

/**
 * 내가 응모한 내역 — 응모가 접수되면 features/enter-event가 이 쿼리를 무효화한다.
 * Page<T>는 기본 20건씩이라 totalElements까지 전부 모아야 합계·목록이 정확하다
 */
export function useMyEntries() {
    return useQuery({
        ...pollingReadPolicy,
        queryKey: [...ENTRIES_KEY, 'me'],
        queryFn: (context) =>
            withPollingReadGuard(context, () => fetchAllMyEntries(context.signal)),
    });
}

/**
 * 이 이벤트에 접수된 내 응모 내역 (E06, status=ACCEPTED).
 * 이벤트 상세의 '이번 래플' 카운터가 쓴다 — 이벤트 상세 응답에는 myEntryCount·myTicketCount가
 * 없어(백엔드 미합의) 여기서 직접 계산한다. 응모 접수 시 ENTRIES_KEY 무효화로 함께 갱신된다.
 */
export function useMyEventEntries(eventId: string) {
    return useQuery({
        ...pollingReadPolicy,
        queryKey: [...ENTRIES_KEY, 'me', 'event', eventId],
        queryFn: (context) =>
            withPollingReadGuard(context, () =>
                fetchAllMyEntries(context.signal, { eventId, status: 'ACCEPTED' }),
            ),
        enabled: eventId !== '',
    });
}

export const entryStatisticsApiPath = (eventId: string) => `/v1/events/${eventId}/statistics`;
export const entryEligibilityApiPath = (eventId: string) => `/v1/events/${eventId}/eligibility`;

// 응모 현황 조회·키 — 단건 훅과 여러 건 훅이 같은 키로 캐시를 나눠 쓴다
const entryStatisticsKey = (eventId: string) => [...ENTRIES_KEY, 'statistics', eventId] as const;
const fetchEntryStatistics = async (eventId: string, signal: AbortSignal) => {
    const { data } = await apiClient.get<unknown>(entryStatisticsApiPath(eventId), { signal });
    return envelopeSchema(entryStatisticsSchema).parse(data).data;
};

interface EntryStatisticsOptions {
    /** 응모 진행 중(open) 이벤트인가 — true일 때만 30초 폴링한다 (ADR-0007) */
    isOpen?: boolean;
    /** 홈 배너처럼 여러 이벤트가 겹쳐 보이는 곳에서 현재 보이는 항목만 켠다 */
    enabled?: boolean;
}

/**
 * 이벤트 응모 현황(E03). 이벤트 쿼리와 분리해 현황 수치만 가볍게 다시 받는다.
 * 폴링은 open 이벤트에만 건다 — 그 외 상태는 값이 더 늘지 않는다. 백그라운드 탭은 TanStack Query 기본값대로 쉰다
 */
export function useEntryStatistics(
    eventId: string,
    { isOpen = false, enabled = true }: EntryStatisticsOptions = {},
) {
    return useQuery({
        ...queryPresets.realtime,
        ...pollingReadPolicy,
        queryKey: entryStatisticsKey(eventId),
        queryFn: (context) =>
            withPollingReadGuard(context, () => fetchEntryStatistics(eventId, context.signal)),
        enabled,
        refetchInterval: (query) => pollingReadInterval(query, isOpen),
    });
}

/**
 * 여러 이벤트의 응모 현황(E03)을 한 번에 — 관리자 대시보드처럼 진행 중 이벤트들을 나란히 비교할 때 쓴다.
 * 진행 중 이벤트만 넘기므로 realtime 프리셋대로 폴링한다. 결과 순서는 넘긴 eventIds 순서와 같고,
 * 조회에 실패한 이벤트는 null(그 줄만 '현황 없음'), 아직 받는 중이면 undefined
 */
export function useEntryStatisticsList(
    eventIds: readonly string[],
): (EntryStatistics | null | undefined)[] {
    return useQueries({
        queries: eventIds.map((eventId) => ({
            ...queryPresets.realtime,
            ...pollingReadPolicy,
            queryKey: entryStatisticsKey(eventId),
            queryFn: (context) =>
                withPollingReadGuard(context, () => fetchEntryStatistics(eventId, context.signal)),
            refetchInterval: (query: { state: { error: unknown } }) => pollingReadInterval(query),
        })),
        combine: (results) =>
            results.map((result) => result.data ?? (result.isError ? null : undefined)),
    });
}

interface EntryEligibilityOptions {
    /** 이벤트가 진행 중일 때만 자격을 조회할지 — 화면은 응모 버튼이 보이는 구간에서만 켠다 */
    enabled?: boolean;
}

/**
 * 응모 자격 조회(E07). 보유량 계산·버튼 게이팅·불가 사유 안내의 서버 판정 결과다.
 * 응모가 접수되면 ENTRIES_KEY 접두사로 함께 무효화된다
 */
export function useEntryEligibility(
    eventId: string,
    { enabled = true }: EntryEligibilityOptions = {},
) {
    return useQuery({
        queryKey: [...ENTRIES_KEY, 'eligibility', eventId],
        queryFn: async () => {
            const { data } = await apiClient.get<unknown>(entryEligibilityApiPath(eventId));
            return envelopeSchema(entryEligibilitySchema).parse(data).data;
        },
        enabled,
    });
}
