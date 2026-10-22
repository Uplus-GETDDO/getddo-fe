import { useReducedMotion } from 'framer-motion';
import { XIcon } from 'lucide-react';
import { Dialog as DialogPrimitive } from 'radix-ui';
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';

import type { TicketGrade } from '@entities/ticket';

import { TICKET_GRADE_LABEL } from '@entities/ticket';
import { Button } from '@shared/ui/button';
import {
    Dialog,
    DialogClose,
    DialogDescription,
    DialogOverlay,
    DialogTitle,
} from '@shared/ui/dialog';

import type { GachaPhase } from './CapsuleGacha';

import { CapsuleGacha } from './CapsuleGacha';

/**
 * 게임 보상 적립 안내 — 오늘 첫 유효 플레이로 응모권을 받았을 때 결과 화면 위에 한 번 띄운다.
 * 공용 모달 부품(Dialog·DialogOverlay·DialogTitle·DialogDescription·DialogClose)을 그대로 쓰고,
 * 게임 화면 안에만 뜨도록 막을 fixed 대신 absolute로 바꾸고 포털 없이 그 자리에 그린다.
 * 공용 DialogContent는 포털·화면 전체 막이 묶여 있어 본문 상자만 같은 radix 부품으로 둔다.
 * 쓰는 쪽(게임 화면)이 position: relative여야 한다.
 * 응모권은 모달이 뜰 때 이미 적립돼 있다 — 캡슐 뽑기는 받은 등급을 보여 주는 연출이라 뽑지 않고 닫아도 된다.
 * 받은 응모권을 바로 쓸 수 있게 겟또타임으로 이어 준다 (등급 가중치는 응모할 때·응모권 내역에서 알린다)
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
                <RewardBody tickets={tickets} grade={grade} />
            </DialogPrimitive.Content>
        </Dialog>
    );
}

function RewardBody({ tickets, grade }: { tickets: number; grade?: TicketGrade | null }) {
    const reduceMotion = useReducedMotion() ?? false;
    // 동작 줄이기 설정이면 뽑기 없이 열린 캡슐부터 보여 준다
    const [phase, setPhase] = useState<GachaPhase>(reduceMotion ? 'revealed' : 'idle');
    const revealed = phase === 'revealed';
    const pullRef = useRef<HTMLButtonElement>(null);
    const raffleRef = useRef<HTMLAnchorElement>(null);
    // 키보드로 '보상 뽑기'를 눌렀다면 열린 뒤 초점을 '응모하러 가기'로 옮긴다 — 버튼이 사라져 초점이 모달 상자로 튀지 않게
    const pulledByButton = useRef(false);
    useEffect(() => {
        if (revealed && pulledByButton.current) raffleRef.current?.focus();
    }, [revealed]);

    return (
        <>
            <CapsuleGacha
                phase={phase}
                onPhaseChange={setPhase}
                grade={grade}
                reduceMotion={reduceMotion}
            />
            {/*
              공용 DialogTitle·Description의 기본 글자 스타일 위에 덮어쓴다 (GameGuideDialog와 같은 방식).
              공용 cn이 글자 크기와 색 토큰을 한 그룹으로 보고 하나를 지우므로 색은 안쪽 글자에 준다
            */}
            <div className="flex flex-col items-center gap-1" aria-live="polite">
                <DialogTitle className="text-body-bold! leading-6">
                    {!revealed
                        ? '오늘의 게임 보상이 도착했어요'
                        : grade
                          ? `${TICKET_GRADE_LABEL[grade]} 응모권 ${tickets}장을 받았어요`
                          : `응모권 ${tickets}장을 적립했어요`}
                </DialogTitle>
                {/* 연 뒤에는 제목만으로 충분해 화면에서 감추고, 스크린리더에는 어떤 보상인지 남긴다 */}
                <DialogDescription className={revealed ? 'sr-only' : 'text-body-sm!'}>
                    <span className="text-fg-secondary">
                        {revealed
                            ? '오늘의 게임 보상이에요.'
                            : '손잡이나 버튼을 눌러 캡슐을 뽑아 보세요.'}
                    </span>
                </DialogDescription>
            </div>
            {revealed ? (
                // 받은 응모권을 쓰러 가는 길 — 주 버튼은 검정 primary, 닫기는 테두리 secondary. 낮은 게임 화면에 맞게 한 줄에 둔다
                <div className="flex w-full gap-2">
                    <DialogClose asChild>
                        <Button variant="secondary" className="flex-1">
                            닫기
                        </Button>
                    </DialogClose>
                    <Button asChild className="flex-1">
                        <Link ref={raffleRef} to="/time-raffle">
                            응모하러 가기
                        </Link>
                    </Button>
                </div>
            ) : (
                <Button
                    ref={pullRef}
                    // disabled면 초점을 잃어 뽑는 동안 초점이 화면 밖(body)으로 빠진다 — aria-disabled로 막고 초점은 남긴다
                    aria-disabled={phase !== 'idle'}
                    className="aria-disabled:bg-surface-disabled aria-disabled:text-fg-disabled aria-disabled:hover:bg-surface-disabled w-full aria-disabled:cursor-default"
                    onClick={() => {
                        if (phase !== 'idle') return;
                        pulledByButton.current = document.activeElement === pullRef.current;
                        setPhase('spinning');
                    }}
                >
                    {phase === 'idle' ? '보상 뽑기' : '뽑는 중…'}
                </Button>
            )}
        </>
    );
}
