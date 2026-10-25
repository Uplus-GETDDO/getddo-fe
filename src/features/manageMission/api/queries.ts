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
            // finally 절은 React Compiler가 건너뛴다 — 성공·실패 양쪽에서 직접 해제한다 (GD-347)
            try {
                const { data } = await apiClient.post<unknown>(
                    ADMIN_MISSIONS_PATH,
                    missionWriteSchema.parse(body),
                );
                const created = envelopeSchema(adminMissionSchema).parse(data).data;
                busy.current = false;
                return created;
            } catch (error) {
                busy.current = false;
                lastError.current = error;
                getPollingRetryDelay(error);
                throw error;
            }
        },
        onSettled: () =>
            Promise.all([
                client.invalidateQueries({ queryKey: ADMIN_MISSIONS_KEY }),
                client.invalidateQueries({ queryKey: MISSIONS_KEY }),
            ]),
    });
}
