import { useState } from 'react';
import { toast } from 'sonner';

import type { AdminEvent } from '@entities/event';

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
import { Input } from '@shared/ui/input';
import { formatKst } from '@shared/utils/date';

import { useDeleteEvent, useEventAction } from '../api/queries';

export type EventActionKind = 'cancel' | 'delete';

const ACTION_META: Record<
    EventActionKind,
    { title: string; description: string; submitLabel: string; pendingLabel: string }
> = {
    cancel: {
        title: '이벤트 취소',
        description: '이벤트를 최종 종료합니다. 취소는 되돌릴 수 없으며 응모권이 반환됩니다.',
        submitLabel: '취소',
        pendingLabel: '취소 중…',
    },
    delete: {
        title: '이벤트 삭제',
        description:
            '이벤트와 경품 정보를 삭제합니다. 시작 전이며 응모 이력이 없는 이벤트만 삭제할 수 있습니다.',
        submitLabel: '삭제',
        pendingLabel: '삭제 중…',
    },
};

const DESTRUCTIVE: ReadonlySet<EventActionKind> = new Set(['cancel', 'delete']);

interface EventActionDialogProps {
    event: AdminEvent | null;
    action: EventActionKind | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    /** 삭제 후에는 상세 화면이 유효하지 않으므로 호출부에서 목록으로 보낸다 */
    onDeleted?: () => void;
}

// 사유 입력 다이얼로그 — spec상 취소는 사유가 필수, 삭제는 확인만 거친다
export function EventActionDialog({
    event,
    action,
    open,
    onOpenChange,
    onDeleted,
}: EventActionDialogProps) {
    const [reason, setReason] = useState('');
    const eventAction = useEventAction('cancel');
    const deleteEvent = useDeleteEvent();

    if (!event || !action) {
        return null;
    }

    const meta = ACTION_META[action];
    const mutation = action === 'delete' ? deleteEvent : eventAction;
    const reasonRequired = action !== 'delete';
    const canSubmit = !mutation.isPending && (!reasonRequired || reason.trim().length > 0);

    const reset = () => {
        setReason('');
        eventAction.reset();
        deleteEvent.reset();
    };

    const submit = () => {
        const onSuccess = () => {
            toast.success(`${meta.title}했습니다`);
            onOpenChange(false);
            reset();
            if (action === 'delete') onDeleted?.();
        };
        if (action === 'delete') {
            deleteEvent.mutate(event.id, { onSuccess });
        } else {
            eventAction.mutate({ eventId: event.id, reason: reason.trim() }, { onSuccess });
        }
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
                    <DialogTitle className="text-title-3 text-fg-primary">{meta.title}</DialogTitle>
                    <DialogDescription className="text-body-sm text-fg-secondary">
                        {event.title} · {formatKst(event.startsAt)} ~ {formatKst(event.endsAt)}
                    </DialogDescription>
                </DialogHeader>

                <p className="text-body-sm text-fg-secondary">{meta.description}</p>

                {reasonRequired && (
                    <div className="flex flex-col gap-2">
                        <label
                            htmlFor="event-action-reason"
                            className="text-body-bold text-fg-primary"
                        >
                            사유 (필수)
                        </label>
                        <Input
                            id="event-action-reason"
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            placeholder="운영 사유를 입력하세요"
                        />
                    </div>
                )}

                {mutation.isError && (
                    <p className="text-semantic-error-strong text-body-sm">
                        {getErrorMessage(
                            mutation.error,
                            `${meta.title}에 실패했습니다. 상태를 확인한 뒤 다시 시도해주세요.`,
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
                        variant={DESTRUCTIVE.has(action) ? 'destructive' : 'primary'}
                        className="text-body-bold h-10 flex-1"
                        disabled={!canSubmit}
                        onClick={submit}
                    >
                        {mutation.isPending ? meta.pendingLabel : meta.submitLabel}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
