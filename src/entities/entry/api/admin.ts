import { useQuery } from '@tanstack/react-query';
import { z } from 'zod';

import { apiClient } from '@shared/api/client';
import { envelopeSchema, pageSchema } from '@shared/api/envelopeSchema';
import { queryPresets } from '@shared/api/queryPresets';

import { adminEntrySchema, adminParticipantSchema, entryStatusSchema } from '../model/types';

export const ADMIN_ENTRIES_KEY = ['admin', 'entries'] as const;
export const adminEntriesParamsSchema = z
    .object({
        page: z.number().int().min(1),
        size: z.number().int().min(1).max(100),
        userId: z.uuid().optional(),
        eventId: z.uuid().optional(),
        status: entryStatusSchema.optional(),
        from: z.iso.datetime({ offset: true }).optional(),
        to: z.iso.datetime({ offset: true }).optional(),
    })
    .refine((p) => !p.from || !p.to || Date.parse(p.from) < Date.parse(p.to), {
        message: '시작 시각은 종료 시각보다 빨라야 합니다.',
    });
export type AdminEntriesParams = z.infer<typeof adminEntriesParamsSchema>;

export function useAdminEntries(params: AdminEntriesParams) {
    return useQuery({
        ...queryPresets.noCache,
        retry: false,
        queryKey: [...ADMIN_ENTRIES_KEY, 'list', params],
        queryFn: async () => {
            const { data } = await apiClient.get<unknown>('/v1/admin/entries', {
                params: adminEntriesParamsSchema.parse(params),
            });
            return envelopeSchema(pageSchema(adminEntrySchema)).parse(data).data;
        },
    });
}

export function useAdminParticipants(
    eventId: string | null,
    params: { page: number; size: number },
) {
    return useQuery({
        ...queryPresets.noCache,
        retry: false,
        queryKey: [...ADMIN_ENTRIES_KEY, 'participants', eventId, params],
        enabled: !!eventId && z.uuid().safeParse(eventId).success,
        queryFn: async () => {
            const { data } = await apiClient.get<unknown>(
                `/v1/admin/events/${encodeURIComponent(eventId!)}/participants`,
                { params },
            );
            return envelopeSchema(pageSchema(adminParticipantSchema)).parse(data).data;
        },
    });
}
