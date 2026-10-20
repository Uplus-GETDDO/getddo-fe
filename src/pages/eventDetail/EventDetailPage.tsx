import { useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { toast } from 'sonner';

import type { EntryTickets } from '@entities/entry';
import type { Event } from '@entities/event';

import { useEntryEligibility } from '@entities/entry';
import { useEvent } from '@entities/event';
import { TicketBalanceStatus, useMyTickets } from '@entities/ticket';
import { useEnterEvent } from '@features/enterEvent';
import { getErrorMessage } from '@shared/api/errorMessage';
import { Loading } from '@shared/ui/loading';
import { formatYmd } from '@shared/utils/date';
import {
    EntryCompleteDialog,
    EntryConfirmDialog,
    InsufficientTicketsDialog,
    readEligibility,
} from '@widgets/eventEntry';

import { ColorPickEventVisual } from './ui/ColorPickEventVisual';
import { CouponEventVisual } from './ui/CouponEventVisual';
import { DailyEventVisual } from './ui/DailyEventVisual';
import { EventDetailBody } from './ui/EventDetailBody';
import { EventDetailVisual } from './ui/EventDetailVisual';
import { EventEntryBar } from './ui/EventEntryBar';
import { PointEventVisual } from './ui/PointEventVisual';
import { VoucherEventVisual } from './ui/VoucherEventVisual';

const CONTAINER = 'mx-auto w-full max-w-312 px-6 pb-28';

/**
 * 캠페인 비주얼의 꼴을 골라 그린다 — 꼴마다 레이아웃과 색이 아예 다른 별개 디자인이다.
 * 새 꼴이 생기면 스키마에 분기를 더하고 여기에 한 줄을 더한다 (Event.detailVisual).
 */
function CampaignVisual({
    event,
    visual,
}: {
    event: Event;
    visual: NonNullable<Event['detailVisual']>;
}) {
    switch (visual.template) {
        case 'coupon':
            return <CouponEventVisual event={event} visual={visual} />;
        case 'daily':
            return <DailyEventVisual event={event} visual={visual} />;
        case 'point':
            return <PointEventVisual event={event} visual={visual} />;
        case 'colorPick':
            return <ColorPickEventVisual event={event} visual={visual} />;
        case 'voucher':
            return <VoucherEventVisual event={event} visual={visual} />;
        case 'prizeTiers':
            return <EventDetailVisual event={event} visual={visual} />;
    }
}

/**
 * 이벤트 상세 — 상세 이미지 한 장과 응모 버튼 하나로 된 화면 (실제 U+ 이벤트 페이지와 같은 구조).
 *
 * 등급별 장수를 고르는 겟또타임과 달리 고를 것이 없다. 응모권 미사용 이벤트는 빈 맵을, 쓰는
 * 이벤트는 브론즈 1장을 보낸다 — 가중치를 적용하는 이벤트는 겟또타임 화면이 맡는다.
 * 최종 접수 여부는 서버 응답을 따른다 (E04).
 */
export function EventDetailPage() {
    const { id = '' } = useParams();
    const { data: event, isPending, isError } = useEvent(id);
    const ticketsQuery = useMyTickets();
    const ticket = ticketsQuery.data;
    // 응모 자격은 서버 판정으로 받는다 — 진행 중일 때만 조회한다 (E07)
    const { data: eligibility } = useEntryEligibility(id, { enabled: event?.status === 'open' });
    const enterEvent = useEnterEvent(id);
    const [confirmOpen, setConfirmOpen] = useState(false);
    const [shortfallOpen, setShortfallOpen] = useState(false);
    const [completeOpen, setCompleteOpen] = useState(false);
    // 완료 모달이 쓸 값 — 접수 직후에는 잔액 쿼리가 아직 갱신 전이라 응답 기준으로 계산해 담아 둔다
    const [lastBalance, setLastBalance] = useState<number | null>(null);
    // 모달을 닫으면 방금 누른 응모 버튼으로 포커스를 되돌린다
    const entryButtonRef = useRef<HTMLButtonElement>(null);

    if (isPending) {
        return (
            <main className={CONTAINER}>
                <Loading size="lg" />
            </main>
        );
    }

    if (isError) {
        return (
            <main className={CONTAINER}>
                <p className="text-destructive text-body-sm">이벤트를 불러오지 못했습니다.</p>
            </main>
        );
    }

    const isFree = event.eventType === 'NO_TICKET';
    // 자격 사유를 세 갈래로 읽는 규칙은 겟또타임 상세와 같다 (E07)
    const { completed, forbidden, lacking } = readEligibility(eligibility);
    // 요청에 실을 장수 맵 — 미사용은 빈 맵, 쓰는 이벤트는 브론즈 1장 고정
    const requestedTickets: EntryTickets = isFree ? {} : { BRONZE: 1 };
    const balance = ticket?.availableCount ?? null;
    const balanceBlocked = !isFree && (!ticket || ticketsQuery.isError || ticketsQuery.isFetching);
    const balanceLabel = ticketsQuery.isError
        ? '응모권 잔액을 다시 조회해 주세요'
        : '응모권 잔액을 확인하는 중이에요';
    const canEnter = event.status === 'open' && !completed && !forbidden;
    const hasEnoughTickets =
        !lacking && (isFree || (ticket != null && ticket.countByGrade.BRONZE >= 1));

    return (
        <main className={CONTAINER}>
            {/*
             * 캠페인 비주얼이 있는 이벤트는 그 안에 칩·제목·기간이 다 들어 있어 머리말을 또 두지 않는다 —
             * 같은 제목이 두 번 나오고 비주얼의 첫 화면이 반 토막 난다
             */}
            {event.detailVisual ? (
                <div className="pt-6">
                    <CampaignVisual event={event} visual={event.detailVisual} />
                </div>
            ) : (
                <>
                    {(event.tags?.length ?? 0) > 0 && (
                        <div className="flex flex-wrap items-center gap-2">
                            {event.tags?.map((tag) => (
                                <span
                                    key={tag}
                                    className="bg-status-active border-status-active-text text-status-active-text text-caption rounded-full border px-3 py-0.5"
                                >
                                    {tag}
                                </span>
                            ))}
                        </div>
                    )}

                    {/*
                     * 목록에서 바로 들어오는 최상위 화면이라 겟또타임·미션 상세와 같은 title-1을 쓴다.
                     * title-2는 마이페이지가 여는 하위 화면(PageHeader) 크기다
                     */}
                    <h1 className="text-title-1 text-fg-primary mt-2">{event.title}</h1>

                    <p className="text-body-sm text-fg-tertiary mt-2">
                        {formatYmd(event.startsAt)} ~ {formatYmd(event.endsAt)}
                    </p>

                    <hr className="border-border-default mt-6" />

                    <div className="mt-10">
                        <EventDetailBody event={event} />
                    </div>
                </>
            )}

            {!isFree && !confirmOpen && <TicketBalanceStatus query={ticketsQuery} />}
            <EventEntryBar
                event={event}
                completed={completed}
                forbidden={forbidden}
                buttonRef={entryButtonRef}
                balanceBlocked={balanceBlocked || enterEvent.isPending}
                balanceLabel={balanceLabel}
                onEnter={() =>
                    !balanceBlocked &&
                    (hasEnoughTickets ? setConfirmOpen(true) : setShortfallOpen(true))
                }
            />

            <EntryConfirmDialog
                open={confirmOpen}
                onOpenChange={setConfirmOpen}
                title={event.title}
                tickets={requestedTickets}
                balance={balance}
                returnFocusTo={entryButtonRef}
                pending={enterEvent.isPending}
                disabled={balanceBlocked || !canEnter || !hasEnoughTickets}
                notice={
                    !isFree && (
                        <>
                            <TicketBalanceStatus query={ticketsQuery} />
                            {!balanceBlocked && !hasEnoughTickets && (
                                <p
                                    role="status"
                                    className="text-body-sm text-semantic-error-strong"
                                >
                                    브론즈 응모권이 부족해요. 취소한 뒤 잔액을 확인해 주세요.
                                </p>
                            )}
                        </>
                    )
                }
                onConfirm={() => {
                    if (balanceBlocked || !canEnter || !hasEnoughTickets) return;
                    enterEvent.mutate(requestedTickets, {
                        onSuccess: (entry) => {
                            setConfirmOpen(false);
                            setLastBalance(
                                balance === null
                                    ? null
                                    : Math.max(0, balance - entry.deductedTicketCount),
                            );
                            setCompleteOpen(true);
                        },
                        onError: (error) => {
                            setConfirmOpen(false);
                            // 업무 오류는 코드별 문구를 보여 주고, 네트워크 오류만 일반 문구를 쓴다
                            toast.error(
                                getErrorMessage(
                                    error,
                                    '응모에 실패했어요. 잠시 후 다시 시도해 주세요.',
                                ),
                            );
                        },
                    });
                }}
            />

            <InsufficientTicketsDialog
                open={shortfallOpen}
                onOpenChange={setShortfallOpen}
                bronzeRequired={!isFree}
                returnFocusTo={entryButtonRef}
            />

            <EntryCompleteDialog
                open={completeOpen}
                onOpenChange={setCompleteOpen}
                title={event.title}
                tickets={requestedTickets}
                gradeReflected={false}
                remainingBalance={lastBalance}
                // 이벤트는 사용자당 1회라 접수 뒤에 더 낼 수 있는 응모권이 없다
                remainingAllowance={0}
                returnFocusTo={entryButtonRef}
            />
        </main>
    );
}
