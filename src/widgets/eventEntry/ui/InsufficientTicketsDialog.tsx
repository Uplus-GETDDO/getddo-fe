import type { RefObject } from 'react';

import { Link } from 'react-router-dom';

import { Button } from '@shared/ui/button';
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@shared/ui/dialog';

interface InsufficientTicketsDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    /** 이 이벤트는 브론즈만 쓸 수 있을 때 — 일반 부족 안내와 구분해 브론즈 적립을 안내한다 (ENTRY-008) */
    bronzeRequired?: boolean;
    /** 닫은 뒤 포커스를 되돌릴 요소 — 트리거 없이 상태로 여는 모달이라 Radix가 포커스를 body로 떨어뜨린다 */
    returnFocusTo?: RefObject<HTMLElement | null>;
}

/** 고른 수량보다 보유 응모권이 적을 때 안내한다 — 응모는 접수하지 않고 적립 경로만 알려준다 */
export function InsufficientTicketsDialog({
    open,
    onOpenChange,
    bronzeRequired = false,
    returnFocusTo,
}: InsufficientTicketsDialogProps) {
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
                <DialogHeader className="gap-2 pr-8">
                    <DialogTitle className="text-title-3 text-fg-primary">
                        {bronzeRequired ? '브론즈 응모권이 필요해요' : '응모권이 부족해요'}
                    </DialogTitle>
                    <DialogDescription className="text-body text-fg-secondary">
                        {bronzeRequired
                            ? '이 이벤트는 브론즈 응모권으로만 응모할 수 있어요. 출석 체크, 게임 등 미션에 참여하면 브론즈 응모권을 모을 수 있어요.'
                            : '출석 체크, 게임 등 미션에 참여하면 응모권을 모을 수 있어요.'}
                    </DialogDescription>
                </DialogHeader>

                <div className="flex gap-4">
                    <DialogClose asChild>
                        <Button variant="secondary" className="flex-1">
                            닫기
                        </Button>
                    </DialogClose>
                    <Button asChild className="flex-1">
                        <Link to="/missions">응모권 모으러 가기</Link>
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
