import type { RefObject } from 'react';

import type { Event } from '@entities/event';

import { Button } from '@shared/ui/button';

/** 응모할 수 없는 상태에서 버튼에 대신 적는 문구 — 겟또타임 상세와 같은 말을 쓴다 */
const STATUS_LABEL: Record<Event['status'], string> = {
    open: '응모하기',
    upcoming: '오픈 예정',
    closed: '응모 마감',
    drawn: '발표 완료',
    canceled: '이벤트 취소',
    ended: '추첨 없이 종료',
};

interface EventEntryBarProps {
    event: Event;
    /** 서버가 '끝난 응모'로 판정했다 (E07 ALREADY_ENTERED·TICKET_LIMIT_EXCEEDED) */
    completed: boolean;
    /** 장수로 해소되지 않는 자격 부재 — 눌러도 소용없다 */
    forbidden: boolean;
    balanceBlocked: boolean;
    balanceLabel: string;
    onEnter: () => void;
    buttonRef?: RefObject<HTMLButtonElement | null>;
}

/**
 * 이벤트 상세의 유일한 조작 — 하단에 붙는 응모 버튼.
 *
 * 상세 본문이 세로로 긴 이미지 한 장이라 끝까지 내려야 버튼이 보이면 참여를 놓친다.
 * 그래서 스크롤을 따라오게 바닥에 붙인다 (미션 답안 제출 바와 같은 방식).
 */
export function EventEntryBar({
    event,
    completed,
    forbidden,
    balanceBlocked,
    balanceLabel,
    onEnter,
    buttonRef,
}: EventEntryBarProps) {
    const isOpen = event.status === 'open';
    const disabled = !isOpen || completed || forbidden || balanceBlocked;
    const label = !isOpen
        ? STATUS_LABEL[event.status]
        : completed
          ? '응모 완료'
          : forbidden
            ? '응모할 수 없어요'
            : balanceBlocked
              ? balanceLabel
              : '응모하기';

    return (
        <div className="bg-surface-page border-border-default sticky bottom-0 -mx-6 mt-10 border-t px-6 py-4">
            <div className="mx-auto w-full max-w-270">
                <Button
                    ref={buttonRef}
                    size="lg"
                    disabled={disabled}
                    onClick={onEnter}
                    className="w-full"
                >
                    {label}
                </Button>
            </div>
        </div>
    );
}
