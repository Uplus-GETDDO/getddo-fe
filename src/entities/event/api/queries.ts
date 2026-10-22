import { useQuery } from '@tanstack/react-query';

import { apiClient } from '@shared/api/client';
import { envelopeSchema, pageSchema } from '@shared/api/envelopeSchema';
import {
    pollingReadInterval,
    pollingReadPolicy,
    queryPresets,
    withPollingReadGuard,
} from '@shared/api/queryPresets';

import type { Event } from '../model/types';

import { eventDetailResponseSchema, eventSummaryResponseSchema } from '../model/contract';
import { isFinalEventStatus } from '../model/eventStatus';
import { toEvent } from '../utils/toEvent';

// spec 원시 응답(EventSummary/EventDetail)을 parse한 뒤 화면용 Event로 변환한다
const eventListSchema = envelopeSchema(pageSchema(eventSummaryResponseSchema));

export const EVENTS_KEY = ['events'] as const;

// 이벤트 도메인의 엔드포인트 — 경로가 바뀌면 여기만 고친다 (다른 슬라이스는 이 상수를 재사용)
export const EVENTS_API_PATH = '/v1/events';
export const eventApiPath = (eventId: string) => `${EVENTS_API_PATH}/${eventId}`;
export const eventEntriesApiPath = (eventId: string) => `${EVENTS_API_PATH}/${eventId}/entries`;

const EVENTS_PAGE_SIZE = 20;

export function useEventList() {
    return useQuery({
        ...queryPresets.realtime,
        ...pollingReadPolicy,
        queryKey: [...EVENTS_KEY, 'list'],
        queryFn: (context) =>
            withPollingReadGuard(context, async () => {
                // Page는 기본 20건씩 자른다 — 목록 화면은 전체를 그리므로 totalElements까지 전부 모은다
                const events: Event[] = [];
                for (let page = 1; ; page += 1) {
                    const { data } = await apiClient.get<unknown>(EVENTS_API_PATH, {
                        params: { page, size: EVENTS_PAGE_SIZE },
                        signal: context.signal,
                    });
                    const parsed = eventListSchema.parse(data).data;
                    events.push(...parsed.items.map(toEvent));
                    if (events.length >= parsed.totalElements) break;
                    if (parsed.items.length === 0)
                        throw new Error('이벤트 전체 목록을 받지 못했습니다. 다시 조회해 주세요.');
                }
                return events;
            }),
        refetchInterval: (query) => pollingReadInterval(query),
        // 폴링은 이벤트 상태 전환(open → closed 등) 감지용이다. 응모 현황 수치는 E03(useEntryStatistics)이 맡는다 (ADR-0007)
    });
}

export function useEvent(
    eventId: string,
    { staleTime, enabled = true }: { staleTime?: number; enabled?: boolean } = {},
) {
    return useQuery({
        ...queryPresets.realtime,
        // 캐러셀처럼 자주 다시 마운트되는 소비자는 폴링 주기만큼 staleTime을 넘긴다 —
        // 같은 주기 안의 재마운트 재조회를 없애고 최신성 상한은 주기 재조회와 같다
        ...(staleTime !== undefined ? { staleTime } : {}),
        ...pollingReadPolicy,
        // 홈 배너처럼 목록 이벤트로 대신 그리는 소비자는 활성 슬라이드만 상세를 켠다
        enabled,
        queryKey: [...EVENTS_KEY, 'detail', eventId],
        queryFn: (context) =>
            withPollingReadGuard(context, async () => {
                const { data } = await apiClient.get<unknown>(eventApiPath(eventId), {
                    signal: context.signal,
                });
                return envelopeSchema(eventDetailResponseSchema).parse(data).data;
            }),
        // 상태 전환 감지용 폴링 (ADR-0007) — 마감 상태도 결과 발표(closed → drawn) 전환을 감지해야 하므로
        // 종결 판정은 원시 상태로 유지한다. 화면에서 취소·대상 없는 종료를 분리해도
        // 추첨 확정과 실제 공개를 혼동하지 않도록 캐시에 원시 응답을 보존한다.
        refetchInterval: (query) => {
            const status = query.state.data?.status;
            return pollingReadInterval(query, status == null || !isFinalEventStatus(status));
        },
        select: toEvent,
    });
}
