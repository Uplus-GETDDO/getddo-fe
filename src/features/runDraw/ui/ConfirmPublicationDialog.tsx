import { useRef, useState } from 'react';
import { toast } from 'sonner';

import type { DrawRun } from '@entities/drawResult';

import { DRAW_TYPE_LABEL } from '@entities/drawResult';
import { getErrorMessage } from '@shared/api/errorMessage';
import { Button } from '@shared/ui/button';
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@shared/ui/dialog';
import { formatKst } from '@shared/utils/date';

import { useConfirmResult } from '../api/queries';

interface ConfirmPublicationDialogProps {
    run: DrawRun | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

// 최초 발표 — 육안 검토를 마친 최신 실행으로 확인·공개를 한 요청으로 처리한다 (GD-199).
// 본문·추가 멱등 헤더 없는 호출이라 사유·확인 입력을 받지 않고, 확인 버튼과 발표를 분리하지 않는다
export function ConfirmPublicationDialog({
    run,
    open,
    onOpenChange,
}: ConfirmPublicationDialogProps) {
    const confirm = useConfirmResult();
    // isPublished=false 응답은 정상 성공이 아니다 — 별도 안내로 남긴다
    const [unpublished, setUnpublished] = useState(false);
    const submitting = useRef(false);

    if (!run) {
        return null;
    }

    const reset = () => {
        setUnpublished(false);
        confirm.reset();
    };

    const submit = () => {
        if (submitting.current) return;
        submitting.current = true;
        confirm.mutate(run.id, {
            onSuccess: (data) => {
                if (data.isPublished) {
                    toast.success(`결과를 발표했습니다 (버전 ${data.revision ?? '-'})`);
                    onOpenChange(false);
                    reset();
                } else {
                    setUnpublished(true);
                }
            },
            onSettled: () => {
                submitting.current = false;
            },
        });
    };

    return (
        <Dialog
            open={open}
            onOpenChange={(next) => {
                onOpenChange(next);
                if (!next) reset();
            }}
        >
            <DialogContent
                showCloseButton={false}
                className="bg-surface-page border-border-default gap-6 rounded-2xl border p-8 shadow-md ring-0 sm:max-w-140"
            >
                <DialogHeader className="gap-2">
                    <DialogTitle className="text-title-3 text-fg-primary">최초 발표</DialogTitle>
                    <DialogDescription className="text-body-sm text-fg-secondary">
                        {run.runNumber}회차 {DRAW_TYPE_LABEL[run.drawType]} 결과를 최종 확인하고
                        전체 명단을 공개합니다.
                    </DialogDescription>
                </DialogHeader>

                <p className="text-body-sm text-fg-secondary">
                    한 번의 요청으로 확인·공개가 함께 확정됩니다. 발표하면 이벤트 상태가 공개됨으로
                    바뀌고 당첨자에게 결과 알림이 생성됩니다. 같은 실행을 다시 발표해도 명단이
                    중복으로 만들어지지 않습니다.
                </p>
                {run.confirmedAt && (
                    <p className="text-caption text-fg-tertiary">
                        실행 확정 {formatKst(run.confirmedAt)}
                    </p>
                )}

                {unpublished && (
                    <p role="alert" className="text-semantic-error-strong text-body-sm">
                        확인은 기록됐지만 서버가 아직 명단을 공개하지 않았습니다. 실행 상태를 다시
                        확인해 주세요.
                    </p>
                )}
                {confirm.isError && (
                    <p
                        id="confirm-publication-error"
                        role="alert"
                        className="text-semantic-error-strong text-body-sm"
                    >
                        {getErrorMessage(
                            confirm.error,
                            '결과를 발표하지 못했습니다. 명단을 다시 확인한 뒤 시도해주세요.',
                        )}
                    </p>
                )}

                <div className="flex gap-4">
                    <DialogClose asChild>
                        <Button
                            variant="secondary"
                            className="bg-surface-sunken border-border-default text-fg-primary text-body-bold hover:bg-surface-pressed h-10 flex-1"
                        >
                            닫기
                        </Button>
                    </DialogClose>
                    <Button className="h-10 flex-1" disabled={confirm.isPending} onClick={submit}>
                        {confirm.isPending ? '발표 중…' : '최초 발표'}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
