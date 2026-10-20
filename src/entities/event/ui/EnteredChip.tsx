import { Check } from 'lucide-react';

import { formatNumber } from '@shared/utils/format';

import type { Event } from '../model/types';

/**
 * 내가 이미 응모한 이벤트라는 표시 — E01 목록의 `myEntered`를 그린다.
 *
 * 접수된 응모가 있다는 사실만 말한다. 추가 응모 자격도 당첨 여부도 아니다
 * (getddo-spec 05-api/event.md 「사용자 목록의 내 응모 여부」). 그래서 여러 장을 더 쓸 수 있는
 * 진행 중 겟또타임에는 RaffleEntryChip을 쓴다.
 *
 * 상세(E02)에는 이 값이 없다 — 거기서는 E07 응모 현황으로 버튼 문구가 정해진다.
 */
export function EnteredChip({ label }: { label: string }) {
    return (
        // 내가 한 일이라 눈에 먼저 들어오게 진한 노랑 바탕에 잉크 글자 (D-day 알약·응모 버튼과 같은 노랑)
        <span className="bg-ticket-primary text-fg-primary text-caption inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-0.5 font-semibold">
            <Check aria-hidden className="size-3" />
            {label}
        </span>
    );
}

/** 이 래플에 더 응모할 수 있는가 — 한도(1인 최대)를 모르거나 없으면(null) 더 쓸 수 있다고 본다 */
function isEntryFull(event: Event, spent: number | undefined): boolean {
    // 응모권 없이 참여하는 래플은 한 번만 응모한다
    if (event.requiredTickets === 0) return true;
    const limit = event.maxTicketsPerUser;
    if (limit == null || spent == null) return false;
    // 남은 한도로 한 번 더 응모할 장수가 안 되면 끝난 것이다
    return limit - spent < event.requiredTickets;
}

/**
 * 진행 중 겟또타임의 내 응모 칩 — 한도까지 더 쓸 수 있으면 '응모 중 · 1/5장', 다 썼으면 '응모 완료'.
 * 둘 다 내가 한 일이라 같은 진한 노랑 바탕이고, 글과 완료 체크 아이콘으로만 나눈다 (응모 중은 아이콘 없이 글만).
 * '완료'라고만 적으면 더 쓸 수 있는데도 버튼이 죽은 줄 알고, '참여 중'만 적으면 몇 장 썼는지 따로 한 줄이 필요했다.
 * 쓴 장수(E03 mySpentTicketCount)를 받기 전에는 '응모 중'만 적는다. 응모하지 않았으면 그리지 않는다
 */
export function RaffleEntryChip({
    event,
    mySpentTicketCount,
}: {
    event: Event;
    mySpentTicketCount?: number;
}) {
    const entered = event.myEntered || (mySpentTicketCount ?? 0) > 0;
    if (!entered) return null;
    if (isEntryFull(event, mySpentTicketCount)) return <EnteredChip label="응모 완료" />;
    const limit = event.maxTicketsPerUser;
    const count =
        mySpentTicketCount != null && mySpentTicketCount > 0
            ? ` · ${formatNumber(mySpentTicketCount)}${limit != null ? `/${formatNumber(limit)}` : ''}장`
            : '';
    return (
        <span className="bg-ticket-primary text-fg-primary text-caption inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 font-semibold tabular-nums">
            응모 중{count}
        </span>
    );
}
