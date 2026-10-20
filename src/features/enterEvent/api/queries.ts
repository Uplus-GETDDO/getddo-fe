import { useMutation, useQueryClient } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import { useRef } from 'react';

import type { EntryTickets } from '@entities/entry';

import { ENTRIES_KEY, entrySchema } from '@entities/entry';
import { EVENTS_KEY, eventEntriesApiPath } from '@entities/event';
import { TICKETS_KEY } from '@entities/ticket';
import { apiClient } from '@shared/api/client';
import { envelopeSchema } from '@shared/api/envelopeSchema';
import { createIdempotencyKey, IDEMPOTENCY_HEADER } from '@shared/utils/idempotencyKey';

interface EntryAttempt {
    tickets: EntryTickets;
    key: string;
}

// 생략된 등급과 0은 같은 요청이다 — 서버도 생략을 0으로 해석한다 (spec EntryRequest)
const sameTickets = (a: EntryTickets, b: EntryTickets) =>
    (a.BRONZE ?? 0) === (b.BRONZE ?? 0) &&
    (a.SILVER ?? 0) === (b.SILVER ?? 0) &&
    (a.GOLD ?? 0) === (b.GOLD ?? 0) &&
    (a.PLATINUM ?? 0) === (b.PLATINUM ?? 0);

/**
 * 이벤트에 응모한다 — tickets는 등급별 장수 맵이고 생략된 등급은 0이다 (spec E04).
 *
 * 응답이 유실되거나 타임아웃된 뒤 같은 장수 맵으로 다시 누르는 것은 새 응모가 아니라 재시도다.
 * 그때 키를 새로 만들면 서버가 멱등 처리를 해도 별개 요청으로 보고 응모권을 또 차감한다.
 * 그래서 장수 맵이 같은 동안에는 키를 유지하고, 접수에 성공하거나 맵을 바꾸면 새로 만든다 (ADR-0005).
 */
export function useEnterEvent(eventId: string) {
    const queryClient = useQueryClient();
    const attemptRef = useRef<EntryAttempt | null>(null);

    return useMutation({
        mutationFn: async (tickets: EntryTickets) => {
            if (!attemptRef.current || !sameTickets(attemptRef.current.tickets, tickets)) {
                attemptRef.current = { tickets: { ...tickets }, key: createIdempotencyKey() };
            }

            const { data } = await apiClient.post<unknown>(
                eventEntriesApiPath(eventId),
                { tickets },
                { headers: { [IDEMPOTENCY_HEADER]: attemptRef.current.key } },
            );
            return envelopeSchema(entrySchema).parse(data).data;
        },
        onSuccess: () => {
            // 다음 응모는 재시도가 아니라 새 건이다
            attemptRef.current = null;

            // E03(응모 현황)·E07(응모 자격)은 ENTRIES_KEY 하위 키라 함께 무효화된다.
            // Promise를 반환하면 갱신이 끝날 때까지 isPending이 유지된다.
            // 먼저 완료 안내를 열어 버리면 갱신 전 남은 한도로 추가 응모를 시작하게 된다.
            return Promise.all([
                queryClient.invalidateQueries({ queryKey: EVENTS_KEY }),
                queryClient.invalidateQueries({ queryKey: TICKETS_KEY }),
                queryClient.invalidateQueries({ queryKey: ENTRIES_KEY }),
            ]);
        },
        onError: (error) => {
            // 서버가 응답한 거절(4xx/5xx)은 결과가 키에 묶여 저장되므로 다음 시도는 새 키로 간다.
            // 응답을 받지 못한 네트워크 오류만 같은 키를 유지해 재시도로 식별되게 한다 (ADR-0005)
            if (isAxiosError(error) && error.response) {
                attemptRef.current = null;
            }
        },
    });
}
