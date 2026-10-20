import { useRef, useState } from 'react';
import { toast } from 'sonner';

import type { DrawResult } from '@entities/drawResult';

import {
    AWARD_CANCELLATION_REASON_MAX_LENGTH,
    awardCancellationRequestSchema,
} from '@entities/winner';
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
import { Textarea } from '@shared/ui/textarea';
import { createIdempotencyKey } from '@shared/utils/idempotencyKey';

import { useCancelWin } from '../api/queries';

interface CancelWinDialogProps {
    result: DrawResult | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    /** 취소가 접수되면 연결된 재추첨 실행 ID와 함께 호출한다 */
    onCanceled?: (replacementDrawRunId: string) => void;
}

// 당첨 취소 사유 입력 — 사유는 재추첨의 업무 근거이므로 필수다 (getddo-spec 추첨 도메인)
export function CancelWinDialog({ result, open, onOpenChange, onCanceled }: CancelWinDialogProps) {
    const [reason, setReason] = useState('');
    const cancel = useCancelWin();
    // 같은 (당첨, 사유) 의도의 재시도는 같은 멱등키로 보낸다. 사유가 바뀌면 다른 요청이므로 새 키를 쓴다
    const intent = useRef<{ winId: string; reason: string; key: string } | null>(null);
    // mutation.isPending은 렌더 이후에 반영되므로 연타를 동기적으로 막는다
    const submitting = useRef(false);

    if (!result) {
        return null;
    }

    // 서버와 같은 기준(trim 후 1~1000자)으로 미리 막는다 — 서버 검증을 대체하지 않는다
    const parsed = awardCancellationRequestSchema.safeParse({ reason });
    const trimmed = parsed.success ? parsed.data.reason : reason.trim();
    const tooLong = trimmed.length > AWARD_CANCELLATION_REASON_MAX_LENGTH;
    const canSubmit = !cancel.isPending && parsed.success;

    const reset = () => {
        setReason('');
        intent.current = null;
        cancel.reset();
    };

    const submit = () => {
        if (submitting.current || !parsed.success) return;
        if (intent.current?.winId !== result.id || intent.current.reason !== trimmed) {
            intent.current = { winId: result.id, reason: trimmed, key: createIdempotencyKey() };
        }
        submitting.current = true;
        cancel.mutate(
            { winId: result.id, reason: trimmed, idempotencyKey: intent.current.key },
            {
                onSuccess: (data) => {
                    // 202는 접수다 — 재추첨 선정은 서버가 비동기로 진행해 실행 목록에서 상태를 확인한다
                    toast.success('당첨 취소를 접수했습니다. 재추첨 실행이 목록에 표시됩니다');
                    onCanceled?.(data.replacementDrawRunId);
                    onOpenChange(false);
                    reset();
                },
                onSettled: () => {
                    submitting.current = false;
                },
            },
        );
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
                    <DialogTitle className="text-title-3 text-fg-primary">당첨 취소</DialogTitle>
                    <DialogDescription className="text-body-sm text-fg-secondary">
                        {result.prizeRank}등 {result.slotNumber}번 슬롯 · 당첨자 {result.userId}
                    </DialogDescription>
                </DialogHeader>

                <p className="text-body-sm text-fg-secondary">
                    당첨을 취소하면 같은 요청으로 재추첨이 등록되고 서버가 즉시 시작합니다. 유지되는
                    당첨자는 그대로 두고 취소된 자리만 보충합니다. 취소는 되돌릴 수 없습니다.
                </p>

                <div className="flex flex-col gap-2">
                    <label htmlFor="cancel-win-reason" className="text-body-bold text-fg-primary">
                        취소 사유 (필수)
                    </label>
                    <Textarea
                        id="cancel-win-reason"
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        placeholder="당첨 취소 사유를 입력하세요"
                        aria-describedby={cancel.isError ? 'cancel-win-error' : undefined}
                    />
                    <p
                        className={
                            tooLong
                                ? 'text-semantic-error-strong text-body-sm'
                                : 'text-fg-secondary text-body-sm'
                        }
                    >
                        {trimmed.length} / {AWARD_CANCELLATION_REASON_MAX_LENGTH}자
                    </p>
                </div>

                {cancel.isError && (
                    <p
                        id="cancel-win-error"
                        role="alert"
                        className="text-semantic-error-strong text-body-sm"
                    >
                        {getErrorMessage(
                            cancel.error,
                            '당첨 취소에 실패했습니다. 상태를 확인한 뒤 다시 시도해주세요.',
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
                    <Button
                        variant="destructive"
                        className="h-10 flex-1"
                        disabled={!canSubmit}
                        onClick={submit}
                    >
                        {cancel.isPending ? '취소 중…' : '당첨 취소'}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
