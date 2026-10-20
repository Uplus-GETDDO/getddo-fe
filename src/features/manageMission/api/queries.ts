import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRef } from 'react';

import type { MissionWrite } from '@entities/mission';

import {
    ADMIN_MISSIONS_KEY,
    ADMIN_MISSIONS_PATH,
    adminMissionSchema,
    MISSIONS_KEY,
    missionWriteSchema,
} from '@entities/mission';
import { apiClient } from '@shared/api/client';
import { envelopeSchema } from '@shared/api/envelopeSchema';
import { getPollingRetryDelay } from '@shared/api/queryPresets';

export function useCreateMission() {
    const client = useQueryClient();
    const busy = useRef(false);
    const lastError = useRef<unknown>(null);
    return useMutation({
        retry: false,
        mutationFn: async (body: MissionWrite) => {
            if (busy.current) throw new Error('미션 등록 처리 중입니다.');
            if (getPollingRetryDelay(lastError.current) > 0) throw lastError.current;
            busy.current = true;
            try {
                const { data } = await apiClient.post<unknown>(
                    ADMIN_MISSIONS_PATH,
                    missionWriteSchema.parse(body),
                );
                return envelopeSchema(adminMissionSchema).parse(data).data;
            } catch (error) {
                lastError.current = error;
                getPollingRetryDelay(error);
                throw error;
            } finally {
                busy.current = false;
            }
        },
        onSettled: () =>
            Promise.all([
                client.invalidateQueries({ queryKey: ADMIN_MISSIONS_KEY }),
                client.invalidateQueries({ queryKey: MISSIONS_KEY }),
            ]),
    });
}
