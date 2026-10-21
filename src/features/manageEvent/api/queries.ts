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

import type { EventImageTarget } from '../model/imageUpload';

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

/**
 * 업로드 응답 — 등록·수정에 실을 imageKey와 미리보기에 쓸 imageUrl.
 *
 * 이름은 05-api/common.md의 「쓰기는 imageKey, 읽기는 imageUrl」 규칙을 그대로 따른다.
 * 업로드 엔드포인트 자체는 아직 spec에 없어 BE 구현에 맞춘 것이다.
 */
const eventImageUploadSchema = z.object({
    imageKey: z.string(),
    imageUrl: z.string(),
});

export const EVENT_IMAGE_UPLOAD_API_PATH = `${ADMIN_EVENTS_API_PATH}/images`;

/**
 * 이벤트·경품 이미지 한 장을 먼저 올리고 키를 받는다.
 *
 * 등록·수정(AE03·AE04)은 그대로 imageKey를 받는다 — 올려 받은 key를 폼에 채워 보내는 구조다.
 * 그래서 이벤트가 아직 없는 등록 화면에서도 쓸 수 있다.
 *
 * 목록 캐시는 건드리지 않는다. 이미지를 올린 것만으로는 이벤트가 달라지지 않는다.
 */
export function useUploadEventImage() {
    return useMutation({
        mutationFn: async ({ file, target }: { file: File; target: EventImageTarget }) => {
            const body = new FormData();
            body.append('file', file);
            const { data } = await apiClient.post<unknown>(EVENT_IMAGE_UPLOAD_API_PATH, body, {
                params: { target },
                // 5MB까지 받으므로 공통 10초로는 느린 회선에서 끊긴다
                timeout: 60_000,
            });
            return envelopeSchema(eventImageUploadSchema).parse(data).data;
        },
    });
}
