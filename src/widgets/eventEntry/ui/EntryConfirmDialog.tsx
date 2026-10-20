import type { ReactNode, RefObject } from 'react';

import { ArrowRight } from 'lucide-react';

import type { EntryTickets } from '@entities/entry';

import { GradeTicketTiles, ticketGradeSchema } from '@entities/ticket';
import { Button } from '@shared/ui/button';
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@shared/ui/dialog';

interface EntryConfirmDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    title: string;
    /** 이번 응모에 쓰는 등급별 장수 — 생략된 등급은 0이다 */
    tickets: EntryTickets;
    /** 지금 보유 중인 응모권 전체 — 잔액을 못 불러왔으면 null */
    balance: number | null;
    onConfirm: () => void;
    /** 접수 요청이 진행 중이면 버튼을 잠근다 — 연타로 중복 요청이 나가지 않게 한다 */
    pending?: boolean;
    disabled?: boolean;
    notice?: ReactNode;
    /** 닫은 뒤 포커스를 되돌릴 요소 — 트리거 없이 상태로 여는 모달이라 Radix가 포커스를 body로 떨어뜨린다 */
    returnFocusTo?: RefObject<HTMLElement | null>;
}

export function EntryConfirmDialog({
    open,
    onOpenChange,
    title,
    tickets,
    balance,
    onConfirm,
    pending = false,
    disabled = false,
    notice,
    returnFocusTo,
}: EntryConfirmDialogProps) {
    const used = ticketGradeSchema.options.filter((grade) => (tickets[grade] ?? 0) > 0);
    const total = used.reduce((sum, grade) => sum + (tickets[grade] ?? 0), 0);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent
                onCloseAutoFocus={(event) => {
                    if (!returnFocusTo?.current) return;
                    event.preventDefault();
                    returnFocusTo.current.focus();
                }}
                className="bg-surface-page border-border-default gap-6 rounded-2xl border p-6 shadow-md ring-0 sm:max-w-120 sm:p-8"
            >
                {/* 오른쪽 위 X 닫기와 긴 제목이 겹치지 않게 비켜 둔다 */}
                <DialogHeader className="pr-8">
                    {/* cn(tailwind-merge)이 text-title-3을 글자색과 겹친다고 보고 지워 16px로 줄어든다 — 안쪽 span에 문자열로 준다 */}
                    <DialogTitle className="leading-normal">
                        <span className="text-title-3 text-fg-primary block">
                            {title}에 응모할까요?
                        </span>
                    </DialogTitle>
                </DialogHeader>

                {/*
                 * 회색 상자 대신 쓰는 등급을 등급 색 칸(응모권 그림)으로 먼저 보이고, 그 아래 절취선을 두고
                 * 합계·남는 장수를 영수증처럼 적는다. 쓸 장수는 여기서 한 번만 보인다 — 제목에 또 적지 않는다.
                 * 사용자가 궁금한 건 지금 몇 장 있는지보다 쓰고 나면 몇 장 남는지라 남는 장수를 보인다
                 */}
                <div className="flex flex-col gap-4">
                    {total > 0 ? (
                        <>
                            <GradeTicketTiles
                                label="이번에 쓸 응모권"
                                items={used.map((grade) => ({
                                    grade,
                                    count: tickets[grade] ?? 0,
                                }))}
                            />
                            <dl className="border-border-default flex flex-col gap-2.5 border-t border-dashed pt-4">
                                <div className="flex items-center justify-between gap-3">
                                    <dt className="text-body-sm text-fg-secondary">
                                        사용할 응모권
                                    </dt>
                                    <dd className="text-body-bold text-fg-primary tabular-nums">
                                        {total}장
                                    </dd>
                                </div>
                                <div className="flex items-center justify-between gap-3">
                                    <dt className="text-body-sm text-fg-secondary">
                                        응모 후 남는 응모권
                                    </dt>
                                    <dd className="flex items-center gap-1.5 tabular-nums">
                                        {balance == null ? (
                                            <span className="text-body-bold text-fg-primary">
                                                -
                                            </span>
                                        ) : (
                                            <>
                                                <span className="text-body-sm text-fg-tertiary">
                                                    {balance}장
                                                </span>
                                                {/* 화면 읽기에는 '10장에서 6장'으로 읽힌다 */}
                                                <span className="sr-only">에서</span>
                                                <ArrowRight
                                                    aria-hidden
                                                    className="text-fg-tertiary size-3.5"
                                                />
                                                <span className="text-body-bold text-fg-primary">
                                                    {Math.max(0, balance - total)}장
                                                </span>
                                            </>
                                        )}
                                    </dd>
                                </div>
                            </dl>
                        </>
                    ) : (
                        <p className="text-body-sm text-fg-secondary">
                            응모권 없이 참여하는 이벤트예요.
                        </p>
                    )}
                    {/* 사용자의 응모 취소는 제공하지 않는다 (getddo-spec 02-domain/entry.md) */}
                    <DialogDescription className="text-caption text-fg-tertiary">
                        응모 후에는 취소할 수 없어요.
                    </DialogDescription>
                </div>

                {notice}
                <div className="flex gap-4">
                    <DialogClose asChild>
                        <Button variant="secondary" className="flex-1">
                            취소
                        </Button>
                    </DialogClose>
                    <Button className="flex-1" disabled={pending || disabled} onClick={onConfirm}>
                        {pending ? '처리 중…' : '응모하기'}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
