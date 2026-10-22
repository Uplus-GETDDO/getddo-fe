import { useReducedMotion } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';

import { Button } from '@shared/ui/button';
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogTitle,
} from '@shared/ui/dialog';

import type { TicketGrade } from '../model/types';
import type { GachaPhase } from './CapsuleGacha';

import { TICKET_GRADE_LABEL } from '../model/grade';
import { CapsuleGacha } from './CapsuleGacha';

/** 보상을 준 곳 — 제목·설명 문구에 붙인다 */
export type TicketRewardSource = '게임' | '미션';

/**
 * 등급 응모권 보상 본문 — 캡슐 뽑기로 받은 등급을 공개하고, 겟또타임으로 이어 준다.
 * 게임(판 안에 띄우는 RewardDialog)과 설문·퀴즈(TicketRewardDialog)가 같은 연출을 쓴다 — 둘 다 브론즈~플래티넘이 나올 수 있다.
 * 모달 상자 안에 두며, 열릴 때마다 처음부터 그리도록 닫히면 사라지는 자리에 둔다.
 * 응모권은 모달이 뜰 때 이미 적립돼 있다 — 뽑기는 받은 등급을 보여 주는 연출이라 뽑지 않고 닫아도 된다
 */
export function TicketRewardContent({
    tickets,
    grade,
    source,
}: {
    tickets: number;
    /** 받은 응모권 등급 — 있으면 캡슐이 열리며 그 등급의 응모권이 나온다 */
    grade?: TicketGrade | null;
    source: TicketRewardSource;
}) {
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
                        ? `오늘의 ${source} 보상이 도착했어요`
                        : grade
                          ? `${TICKET_GRADE_LABEL[grade]} 응모권 ${tickets}장을 받았어요`
                          : `응모권 ${tickets}장을 적립했어요`}
                </DialogTitle>
                {/* 연 뒤에는 제목만으로 충분해 화면에서 감추고, 스크린리더에는 어떤 보상인지 남긴다 */}
                <DialogDescription className={revealed ? 'sr-only' : 'text-body-sm!'}>
                    <span className="text-fg-secondary">
                        {revealed
                            ? `${source} 완료 보상이에요.`
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

/**
 * 화면 전체에 띄우는 보상 모달 — 설문·퀴즈 완료 보상. 게임 판 안에 띄우는 RewardDialog와 본문·크기가 같다
 */
export function TicketRewardDialog({
    open,
    onOpenChange,
    tickets,
    grade,
    source,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    tickets: number;
    grade?: TicketGrade | null;
    source: TicketRewardSource;
}) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent
                // 열릴 때 초점을 버튼이 아닌 모달 상자에 둬, 닫기 버튼에 초점 테두리가 먼저 보이지 않게 한다 (게임 보상 모달과 같은 방식)
                onOpenAutoFocus={(event) => {
                    event.preventDefault();
                    (event.currentTarget as HTMLElement | null)?.focus();
                }}
                className="flex max-w-70 flex-col items-center gap-3 rounded-2xl p-4 text-center outline-none sm:max-w-70"
            >
                <TicketRewardContent tickets={tickets} grade={grade} source={source} />
            </DialogContent>
        </Dialog>
    );
}
