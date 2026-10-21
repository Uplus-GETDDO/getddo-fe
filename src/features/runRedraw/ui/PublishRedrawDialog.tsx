import { useRef } from 'react';
import { toast } from 'sonner';

import type { DrawRun } from '@entities/drawResult';

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

import { usePublishRedraw } from '../api/queries';

interface PublishRedrawDialogProps {
    run: DrawRun | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

// 재추첨 결과 공개 갱신 — AD06은 본문 없는 호출이라 사유를 받지 않는다 (이력의 사유는 취소 사유로 남는다)
export function PublishRedrawDialog({ run, open, onOpenChange }: PublishRedrawDialogProps) {
    const publish = usePublishRedraw();
    const submitting = useRef(false);

    if (!run) {
        return null;
    }

    const submit = () => {
        if (submitting.current) return;
        submitting.current = true;
        publish.mutate(run.id, {
            onSuccess: (data) => {
                toast.success(`공개 명단을 갱신했습니다 (버전 ${data.revision})`);
                onOpenChange(false);
                publish.reset();
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
                if (!next) publish.reset();
            }}
        >
            <DialogContent
                showCloseButton={false}
                className="bg-surface-page border-border-default gap-6 rounded-2xl border p-8 shadow-md ring-0 sm:max-w-140"
            >
                <DialogHeader className="gap-2">
                    <DialogTitle className="text-title-3 text-fg-primary">
                        공개 명단 갱신
                    </DialogTitle>
                    <DialogDescription className="text-body-sm text-fg-secondary">
                        재추첨 {run.runNumber}회차 결과를 확인하고 공개 명단을 갱신합니다.
                    </DialogDescription>
                </DialogHeader>

                <p className="text-body-sm text-fg-secondary">
                    갱신하면 취소자와 새 당첨자에게만 안내가 생성되며 전체 공개 알림은 보내지
                    않습니다. 같은 실행을 다시 갱신해도 버전이 중복으로 생기지 않습니다.
                </p>

                {publish.isError && (
                    <p
                        id="publish-redraw-error"
                        role="alert"
                        className="text-semantic-error-strong text-body-sm"
                    >
                        {getErrorMessage(
                            publish.error,
                            '공개 명단 갱신에 실패했습니다. 잠시 후 다시 시도해주세요.',
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
                    <Button className="h-10 flex-1" disabled={publish.isPending} onClick={submit}>
                        {publish.isPending ? '갱신 중…' : '공개 명단 갱신'}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
