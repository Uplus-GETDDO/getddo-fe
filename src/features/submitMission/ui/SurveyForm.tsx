import { useState } from 'react';
import { toast } from 'sonner';

import type { MissionAnswer, MissionDetail, MissionSubmissionResult } from '@entities/mission';

import { getErrorMessage } from '@shared/api/errorMessage';
import { Button } from '@shared/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@shared/ui/dialog';

import { useSubmitMission } from '../api/queries';
import { MissionAnswersForm } from './MissionAnswersForm';

/**
 * 설문 미션 제출 — 제출이 곧 완료 확정이라 마지막 확인 모달을 거친 뒤 제출한다.
 * 완료 결과는 onCompleted로 올려 페이지가 결과 패널·보상 모달을 띄운다
 * (상세 쿼리 무효화로 이 폼이 언마운트되기 때문).
 */
export function SurveyForm({
    mission,
    onCompleted,
}: {
    mission: MissionDetail;
    /** isNewSubmission: 이번 제출로 막 완료됐으면 true — 재제출 재생(200)에는 보상 연출을 하지 않는다 */
    onCompleted: (result: MissionSubmissionResult, isNewSubmission: boolean) => void;
}) {
    const submitMission = useSubmitMission(mission.id);
    // 확인 모달에 걸어둔 제출 payload — 모달의 '제출하기'를 누르면 이 값으로 요청한다
    const [pendingAnswers, setPendingAnswers] = useState<MissionAnswer[] | null>(null);

    const confirmSubmit = () => {
        if (!pendingAnswers) return;
        submitMission.mutate(pendingAnswers, {
            onSuccess: (outcome) => {
                if (outcome.result.isCompleted) {
                    onCompleted(outcome.result, outcome.isNewSubmission);
                } else {
                    // 계약상 설문의 유효 제출은 곧 완료다 — 미완료 응답은 조용히 넘기지 않는다
                    toast.info(
                        '제출이 접수됐지만 완료 처리되지 않았어요. 잠시 후 다시 확인해 주세요.',
                    );
                }
            },
            onError: (error) => {
                toast.error(
                    getErrorMessage(error, '제출에 실패했습니다. 잠시 후 다시 시도해 주세요.'),
                );
            },
        });
        setPendingAnswers(null);
    };

    return (
        <>
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
                    onClick={() => setPendingAnswers(submitMission.pendingOriginalAnswers!)}
                >
                    원본 답변으로 결과 다시 확인
                </Button>
            )}
            <MissionAnswersForm
                questions={mission.questions}
                isPending={submitMission.isPending}
                submitLabel="제출하기"
                pendingLabel="제출 중…"
                onSubmit={setPendingAnswers}
            />

            <Dialog
                open={pendingAnswers !== null}
                onOpenChange={(open) => {
                    if (!open) setPendingAnswers(null);
                }}
            >
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>설문을 제출할까요?</DialogTitle>
                        <DialogDescription>제출 후에는 답변을 수정할 수 없어요.</DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="secondary" onClick={() => setPendingAnswers(null)}>
                            취소
                        </Button>
                        <Button variant="primary" onClick={confirmSubmit}>
                            제출하기
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}
