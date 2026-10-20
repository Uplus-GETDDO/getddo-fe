import { AnimatePresence, motion, useAnimate } from 'framer-motion';
import { useState } from 'react';
import { toast } from 'sonner';

import type { MissionAnswer, MissionDetail, MissionSubmissionResult } from '@entities/mission';

import { getErrorMessage } from '@shared/api/errorMessage';
import { Button } from '@shared/ui/button';

import { useSubmitMission } from '../api/queries';
import { MissionAnswersForm } from './MissionAnswersForm';

/**
 * 퀴즈 미션 제출 — 오답(isCompleted=false)이면 폼을 흔들며 답변을 유지한 채 재도전할 수 있다.
 * 재도전 횟수 제한은 없다 (미션 도메인 규칙 — 빈도 제한은 서버의 몫).
 * 정답 완료 결과는 onCompleted로 올려 페이지가 결과 패널·보상 모달을 띄운다
 * (상세 쿼리 무효화로 이 폼이 언마운트되기 때문).
 */
export function QuizForm({
    mission,
    onCompleted,
}: {
    mission: MissionDetail;
    /** isNewSubmission: 이번 제출로 막 완료됐으면 true — 재제출 재생(200)에는 보상 연출을 하지 않는다 */
    onCompleted: (result: MissionSubmissionResult, isNewSubmission: boolean) => void;
}) {
    const submitMission = useSubmitMission(mission.id);
    const [lastResult, setLastResult] = useState<MissionSubmissionResult | null>(null);
    const [scope, animate] = useAnimate();

    const submit = (answers: MissionAnswer[]) => {
        submitMission.mutate(answers, {
            onSuccess: (outcome) => {
                if (outcome.result.isCompleted) {
                    onCompleted(outcome.result, outcome.isNewSubmission);
                } else {
                    setLastResult(outcome.result);
                    // 오답 — 폼을 remount하면 입력이 날아가므로 scope만 좌우로 흔든다
                    void animate(scope.current, { x: [0, -10, 8, -6, 4, 0] }, { duration: 0.45 });
                }
            },
            onError: (error) => {
                toast.error(
                    getErrorMessage(error, '제출에 실패했습니다. 잠시 후 다시 시도해 주세요.'),
                );
            },
        });
    };

    return (
        <div ref={scope} className="flex flex-col gap-4">
            <AnimatePresence>
                {lastResult && !lastResult.isCompleted && (
                    <motion.p
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="bg-surface-sunken text-body-sm text-fg-secondary overflow-hidden rounded-xl px-4 py-3"
                    >
                        아쉽지만 오답이에요. 답을 고쳐서 다시 도전해 보세요.
                    </motion.p>
                )}
            </AnimatePresence>
            {submitMission.pendingOriginalAnswers && (
                <p role="alert">
                    이전 제출의 처리 여부가 불확실합니다. 서버 대기 후 원본 답변으로 결과를 다시
                    확인해 주세요.
                </p>
            )}
            {submitMission.pendingOriginalAnswers && (
                <Button
                    type="button"
                    variant="secondary"
                    disabled={submitMission.isPending}
                    onClick={() => submit(submitMission.pendingOriginalAnswers!)}
                >
                    원본 답변으로 결과 다시 확인
                </Button>
            )}
            <MissionAnswersForm
                questions={mission.questions}
                isPending={submitMission.isPending}
                submitLabel="제출하기"
                pendingLabel="채점 중…"
                onSubmit={submit}
                variant="quiz"
                onAnswersChange={() => {
                    // 답을 고치기 시작하면 오답 배너는 거둔다
                    if (lastResult && !lastResult.isCompleted) setLastResult(null);
                }}
            />
        </div>
    );
}
