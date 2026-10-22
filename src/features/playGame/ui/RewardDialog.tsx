import { XIcon } from 'lucide-react';
import { Dialog as DialogPrimitive } from 'radix-ui';

import type { TicketGrade } from '@entities/ticket';

import { TicketRewardContent } from '@entities/ticket';
import { Button } from '@shared/ui/button';
import { Dialog, DialogClose, DialogOverlay } from '@shared/ui/dialog';

/**
 * 게임 보상 적립 안내 — 오늘 첫 유효 플레이로 응모권을 받았을 때 결과 화면 위에 한 번 띄운다.
 * 공용 모달 부품(Dialog·DialogOverlay·DialogTitle·DialogDescription·DialogClose)을 그대로 쓰고,
 * 게임 화면 안에만 뜨도록 막을 fixed 대신 absolute로 바꾸고 포털 없이 그 자리에 그린다.
 * 공용 DialogContent는 포털·화면 전체 막이 묶여 있어 본문 상자만 같은 radix 부품으로 둔다.
 * 쓰는 쪽(게임 화면)이 position: relative여야 한다.
 * 본문(캡슐 뽑기·겟또타임 바로가기)은 설문·퀴즈 보상과 같은 TicketRewardContent를 쓴다 (entities/ticket)
 */
export function RewardDialog({
    open,
    onOpenChange,
    onClosed,
    tickets,
    grade,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    /** 닫힌 뒤 초점을 둘 곳으로 옮긴다 (예: '다시 하기') */
    onClosed?: () => void;
    tickets: number;
    /** 받은 응모권 등급 — 있으면 캡슐이 열리며 그 등급의 응모권이 나온다 */
    grade?: TicketGrade | null;
}) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            {/* 공용 막의 화면 전체 고정·색만 게임 화면에 맞게 덮어쓴다 */}
            <DialogOverlay className="absolute z-10 bg-(--takko-ink)/30 supports-backdrop-filter:backdrop-blur-sm" />
            <DialogPrimitive.Content
                // 열릴 때 초점을 버튼이 아닌 모달 상자에 둬, 키보드로 플레이하던 중에도 버튼에 초점 테두리가 먼저 보이지 않게 한다
                onOpenAutoFocus={(event) => {
                    event.preventDefault();
                    (event.currentTarget as HTMLElement | null)?.focus();
                }}
                onCloseAutoFocus={(event) => {
                    event.preventDefault();
                    onClosed?.();
                }}
                // 게임 화면이 낮으면(좁은 화면) 모달 안에서 스크롤한다
                className="bg-surface-page border-border-default text-fg-primary data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 absolute top-1/2 left-1/2 z-10 flex max-h-[calc(100%-1rem)] w-[min(17.5rem,calc(100%-2rem))] -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-3 rounded-2xl border p-4 text-center shadow-md outline-none max-sm:overflow-y-auto"
            >
                {/* 닫기 — 공용 DialogContent의 닫기 버튼과 같은 부품·모양을 그대로 쓴다 */}
                <DialogClose asChild>
                    <Button
                        variant="ghost"
                        size="icon-sm"
                        className="text-fg-secondary hover:text-fg-primary absolute top-3 right-3 z-1 size-9 cursor-pointer hover:bg-transparent dark:hover:bg-transparent [&_svg:not([class*='size-'])]:size-5"
                    >
                        <XIcon />
                        <span className="sr-only">Close</span>
                    </Button>
                </DialogClose>
                {/* 모달이 열릴 때마다 뽑기를 처음부터 — 본문은 닫히면 사라지고 다시 열면 새로 그린다 */}
                <TicketRewardContent tickets={tickets} grade={grade} source="게임" />
            </DialogPrimitive.Content>
        </Dialog>
    );
}
