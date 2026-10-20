import { useMutation, useQueryClient } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import { useRef } from 'react';

import type { MissionAnswer, MissionSubmissionOutcome } from '@entities/mission';

import { MISSIONS_KEY, missionApiPath, missionSubmissionResultSchema } from '@entities/mission';
import { TICKETS_KEY } from '@entities/ticket';
import { apiClient } from '@shared/api/client';
import { envelopeSchema } from '@shared/api/envelopeSchema';
import { createIdempotencyKey, IDEMPOTENCY_HEADER } from '@shared/utils/idempotencyKey';

interface SubmitAttempt {
    answersJson: string;
    key: string;
}

/**
 * 미션 답변 제출 (M03 초안) — 설문·퀴즈가 같은 엔드포인트를 쓴다.
 *
 * 답변이 같은 동안 멱등키를 유지해 "응답 유실 후 같은 답변 재클릭"을 같은 제출로 묶고,
 * 서버가 응답을 돌려준 뒤의 제출(퀴즈 오답 재도전 포함)은 새 제출이므로 새 키를 쓴다 (ADR-0005).
 */
export function useSubmitMission(missionId: string) {
    const queryClient = useQueryClient();
    const attemptRef = useRef<SubmitAttempt | null>(null);

    return useMutation({
        mutationFn: async (answers: MissionAnswer[]) => {
            const answersJson = JSON.stringify(answers);
            if (attemptRef.current?.answersJson !== answersJson) {
                attemptRef.current = { answersJson, key: createIdempotencyKey() };
            }

            const { data, status } = await apiClient.post<unknown>(
                `${missionApiPath(missionId)}/submissions`,
                { answers },
                { headers: { [IDEMPOTENCY_HEADER]: attemptRef.current.key } },
            );
            const outcome: MissionSubmissionOutcome = {
                result: envelopeSchema(missionSubmissionResultSchema).parse(data).data,
                isNewSubmission: status === 201,
            };
            return outcome;
        },
        onSuccess: (outcome) => {
            attemptRef.current = null;
            // 완료되지 않은 제출(퀴즈 오답)은 완료 상태·잔액이 바뀌지 않는다 — 완료됐을 때만 갱신한다
            if (!outcome.result.isCompleted) return;
            // 재조회를 기다리지 않는다 — 기다리면 새 상세(completed)가 먼저 와서 풀이 폼이 '이미 완료' 화면으로 바뀌며
            // 언마운트되고, 폼의 mutate 콜백(보상 모달 열기)이 불리지 않는다
            void Promise.all([
                queryClient.invalidateQueries({ queryKey: MISSIONS_KEY }),
                queryClient.invalidateQueries({ queryKey: TICKETS_KEY }),
            ]);
        },
        onError: (error) => {
            if (isAxiosError(error) && error.response) {
                attemptRef.current = null;
            }
        },
    });
}
