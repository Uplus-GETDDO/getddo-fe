import { useMutation, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';

import type { EventWriteRequest } from '@entities/event';

import { BANNERS_KEY } from '@entities/banner';
import { ENTRIES_KEY } from '@entities/entry';
import {
    ADMIN_EVENTS_API_PATH,
    ADMIN_EVENTS_KEY,
    adminEventApiPath,
    adminEventSchema,
    eventOperationResultSchema,
    EVENTS_KEY,
} from '@entities/event';
import { TICKETS_KEY } from '@entities/ticket';
import { apiClient } from '@shared/api/client';
import { envelopeSchema } from '@shared/api/envelopeSchema';

type EventAction = 'cancel';

interface EventActionInput {
    eventId: string;
    reason: string;
}

export function useCreateEvent() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (body: EventWriteRequest) => {
            const { data } = await apiClient.post<unknown>(ADMIN_EVENTS_API_PATH, body);
            return envelopeSchema(adminEventSchema).parse(data).data;
        },
        onSuccess: () => {
            void queryClient.invalidateQueries({ queryKey: ADMIN_EVENTS_KEY });
        },
    });
}

export function useUpdateEvent() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ eventId, body }: { eventId: string; body: EventWriteRequest }) => {
            // AE04만 실서버로 전환 — 아직 목업인 나머지 관리자 이벤트 경로와 달리
            // 확정 계약의 /v1 접두사를 붙인다 (알림 N01~N03·AN01~AN05와 같은 규약)
            const { data } = await apiClient.put<unknown>(adminEventApiPath(eventId), body);
            return envelopeSchema(adminEventSchema).parse(data).data;
        },
        onSuccess: () => {
            void queryClient.invalidateQueries({ queryKey: ADMIN_EVENTS_KEY });
        },
    });
}

export function useDeleteEvent() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (eventId: string) => {
            const { data } = await apiClient.delete<unknown>(adminEventApiPath(eventId));
            return envelopeSchema(z.nullable(z.unknown())).parse(data).data;
        },
        onSuccess: () => {
            void queryClient.invalidateQueries({ queryKey: ADMIN_EVENTS_KEY });
        },
    });
}

// 취소는 POST .../cancel {reason} 요청에 EventOperationResult 응답을 돌려준다
export function useEventAction(action: EventAction) {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ eventId, reason }: EventActionInput) => {
            const { data } = await apiClient.post<unknown>(
                `${adminEventApiPath(eventId)}/${action}`,
                { reason },
            );
            return envelopeSchema(eventOperationResultSchema).parse(data).data;
        },
        onSuccess: () => {
            return Promise.all(
                [ADMIN_EVENTS_KEY, EVENTS_KEY, ENTRIES_KEY, TICKETS_KEY, BANNERS_KEY].map(
                    (queryKey) => queryClient.invalidateQueries({ queryKey }),
                ),
            );
        },
    });
}
