import { useMutation, useQueryClient } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import { useRef, useState } from 'react';

import type { MissionAnswer, MissionSubmissionOutcome } from '@entities/mission';

import { MISSIONS_KEY, missionApiPath, missionSubmissionResultSchema } from '@entities/mission';
import { TICKETS_KEY } from '@entities/ticket';
import { ApiError, apiClient, parseRetryAfter } from '@shared/api/client';
import { envelopeSchema } from '@shared/api/envelopeSchema';
import { createIdempotencyKey, IDEMPOTENCY_HEADER } from '@shared/utils/idempotencyKey';

interface SubmitAttempt {
    answersJson: string;
    answers: MissionAnswer[];
    key: string;
    retryAt?: number;
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
    const busy = useRef(false);
    const [pendingOriginalAnswers, setPendingOriginalAnswers] = useState<
        MissionAnswer[] | undefined
    >();

    const mutation = useMutation({
        retry: false,
        mutationFn: async (answers: MissionAnswer[]) => {
            if (busy.current) throw new Error('제출 처리 중입니다.');
            const answersJson = JSON.stringify(answers);
            if (attemptRef.current && attemptRef.current.answersJson !== answersJson) {
                throw new Error(
                    '이전 제출의 처리 여부가 불확실합니다. 이전 답변으로 결과를 먼저 확인해 주세요.',
                );
            }
            if ((attemptRef.current?.retryAt ?? 0) > performance.now()) {
                throw new Error(
                    '요청이 많습니다. 서버 대기 시간이 지난 뒤 같은 답변으로 다시 시도해 주세요.',
                );
            }
            if (attemptRef.current?.answersJson !== answersJson) {
                attemptRef.current = {
                    answersJson,
                    answers: answers.map((answer) => ({ ...answer })),
                    key: createIdempotencyKey(),
                };
            }
            busy.current = true;
            // try/finally는 React Compiler가 건너뛴다 — 성공·실패 양쪽 해제는 promise.finally()로 둔다 (GD-347)
            const { data, status } = await apiClient
                .post<unknown>(
                    `${missionApiPath(missionId)}/submissions`,
                    { answers: attemptRef.current.answers },
                    { headers: { [IDEMPOTENCY_HEADER]: attemptRef.current.key } },
                )
                .finally(() => {
                    busy.current = false;
                });
            const outcome: MissionSubmissionOutcome = {
                result: envelopeSchema(missionSubmissionResultSchema).parse(data).data,
                isNewSubmission: status === 201,
            };
            return outcome;
        },
        onSuccess: (outcome) => {
            attemptRef.current = null;
            setPendingOriginalAnswers(undefined);
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
            const status =
                error instanceof ApiError
                    ? error.status
                    : isAxiosError(error)
                      ? error.response?.status
                      : undefined;
            if (status === 429 && attemptRef.current) {
                const seconds =
                    error instanceof ApiError
                        ? error.retryAfterSeconds
                        : isAxiosError(error)
                          ? parseRetryAfter(error.response?.headers?.['retry-after'])
                          : undefined;
                attemptRef.current.retryAt = performance.now() + (seconds ?? 30) * 1000;
            } else if (status !== undefined && status >= 400 && status < 500) {
                attemptRef.current = null;
            }
            setPendingOriginalAnswers(attemptRef.current?.answers);
        },
    });
    return { ...mutation, pendingOriginalAnswers };
}
