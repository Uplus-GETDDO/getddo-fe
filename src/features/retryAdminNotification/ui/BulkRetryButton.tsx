import { useState } from 'react';
import { toast } from 'sonner';

import { Button } from '@shared/ui/button';
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@shared/ui/dialog';

import type { BulkRetryKind } from '../api/bulk';

import { useBulkRetryNotifications } from '../api/bulk';

const NOUN: Record<BulkRetryKind, string> = { job: '생성 작업', delivery: '발송' };
/** 버튼 이름 — 발송은 같은 알림을 다시 보내는 일이라 '재전송', 생성 작업은 만들기를 다시 시도하는 일이라 '재시도' */
const ACTION: Record<BulkRetryKind, string> = { job: '일괄 재시도', delivery: '일괄 재전송' };

export interface BulkRetryTarget {
    id: string;
    /** 모달 목록에 보일 이름 — 발송은 '알림 제목 · 받는 사람', 작업은 '알림 종류 · 예정 시각' */
    label: string;
}

/**
 * 지금 목록에서 복구할 수 있는(retryable) 실패 건을 한 번에 다시 접수하는 버튼 — 0건이면 숨긴다.
 * 누르면 몇 건을 다시 접수하는지 확인한 뒤 차례로 보내고, 끝나면 접수·실패 건수를 알린다
 */
export function BulkRetryButton({
    kind,
    targets,
}: {
    kind: BulkRetryKind;
    targets: BulkRetryTarget[];
}) {
    const ids = targets.map((target) => target.id);
    const [open, setOpen] = useState(false);
    const bulk = useBulkRetryNotifications(kind);
    if (ids.length === 0) return null;

    const submit = () => {
        bulk.mutate(ids, {
            onSuccess: ({ accepted, failed }) => {
                if (failed === 0) toast.success(`${accepted}건의 ${NOUN[kind]} 복구를 접수했어요.`);
                else
                    toast.warning(
                        `${accepted}건 접수, ${failed}건은 접수하지 못했어요. 목록에서 상태를 확인해 주세요.`,
                    );
                setOpen(false);
            },
        });
    };

    return (
        <>
            <Button size="sm" variant="secondary" onClick={() => setOpen(true)}>
                {ACTION[kind]}
                <span className="bg-surface-sunken text-fg-secondary rounded-full px-1.5 text-xs font-semibold tabular-nums">
                    {ids.length}
                </span>
            </Button>
            <Dialog open={open} onOpenChange={(next) => !bulk.isPending && setOpen(next)}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle className="text-fg-primary text-xl leading-7 font-semibold">
                            {NOUN[kind]} {ACTION[kind]}
                        </DialogTitle>
                        <DialogDescription>
                            아래 실패 건을 한 건씩 다시 접수해요. 접수는 처리 완료가 아니며, 그사이
                            복구할 수 없게 된 건은 건너뛰어요.
                        </DialogDescription>
                    </DialogHeader>
                    {/* 숫자만으로는 무엇이 다시 나가는지 알 수 없어 대상을 그대로 보여 준다 */}
                    <ul
                        aria-label="다시 접수할 대상"
                        className="border-border-default flex max-h-60 flex-col overflow-y-auto border-y"
                    >
                        {targets.map((target) => (
                            <li
                                key={target.id}
                                className="text-body-sm text-fg-primary border-border-default border-b py-2.5 last:border-b-0"
                            >
                                {target.label}
                            </li>
                        ))}
                    </ul>
                    <div className="flex justify-end gap-2">
                        <DialogClose asChild>
                            <Button variant="secondary" disabled={bulk.isPending}>
                                취소
                            </Button>
                        </DialogClose>
                        <Button disabled={bulk.isPending} onClick={submit}>
                            {bulk.isPending
                                ? '접수 중…'
                                : `${ids.length}건 ${kind === 'delivery' ? '재전송' : '재시도'}`}
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </>
    );
}
