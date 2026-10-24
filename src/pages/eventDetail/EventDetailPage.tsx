import { useRef, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';

import type { EntryTickets } from '@entities/entry';
import type { Event } from '@entities/event';

import { useEventResults, useMyResult } from '@entities/drawResult';
import { useEntryEligibility } from '@entities/entry';
import { useEvent } from '@entities/event';
import { TicketBalanceStatus, useMyTickets } from '@entities/ticket';
import { useEnterEvent } from '@features/enterEvent';
import { ApiError } from '@shared/api/client';
import { getErrorMessage } from '@shared/api/errorMessage';
import { useImageFallback } from '@shared/hooks/useImageFallback';
import { Button } from '@shared/ui/button';
import { Loading } from '@shared/ui/loading';
import { formatYmd } from '@shared/utils/date';
import { DrawResultSection } from '@widgets/drawResult';
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
    const eventQuery = useEvent(id);
    const { data: event, isPending, isError } = eventQuery;
    const ticketsQuery = useMyTickets();
    const ticket = ticketsQuery.data;
    // 응모 자격은 서버 판정으로 받는다 — 진행 중일 때만 조회한다 (E07)
    const { data: eligibility } = useEntryEligibility(id, { enabled: event?.status === 'open' });
    // 발표는 마감 뒤에만 조회한다 — 진행 중에 부르면 아직 없는 결과를 계속 묻게 된다 (E08·E09)
    const isAfterClose = event != null && !['open', 'upcoming'].includes(event.status);
    const { data: results } = useEventResults(id, isAfterClose);
    const { data: myResult } = useMyResult(id, isAfterClose);
    const enterEvent = useEnterEvent(id);
    const [confirmOpen, setConfirmOpen] = useState(false);
    const [shortfallOpen, setShortfallOpen] = useState(false);
    const [completeOpen, setCompleteOpen] = useState(false);
    // 완료 모달이 쓸 값 — 접수 직후에는 잔액 쿼리가 아직 갱신 전이라 응답 기준으로 계산해 담아 둔다
    const [lastBalance, setLastBalance] = useState<number | null>(null);
    // 모달을 닫으면 방금 누른 응모 버튼으로 포커스를 되돌린다
    const entryButtonRef = useRef<HTMLButtonElement>(null);
    // 운영자가 올린 대표 이미지 — 주소가 열리지 않으면 칸째로 뺀다
    const hero = useImageFallback(event?.bannerImageUrl);

    if (isPending) {
        return (
            <main className={CONTAINER}>
                <Loading size="lg" />
            </main>
        );
    }

    if (isError) {
        /*
         * 없는 이벤트와 일시적인 실패를 가른다.
         *
         * 끝났거나 지워진 이벤트를 가리키는 알림이 실제로 남아 있어(2026-10-23 실서버 확인)
         * 사용자가 404로 들어온다. 그때 '다시 시도'를 권하면 눌러도 달라지지 않는다.
         * 어느 쪽이든 목록으로 가는 길은 둔다 — 문구 한 줄만 남기면 되돌아갈 데가 없다.
         */
        const notFound = eventQuery.error instanceof ApiError && eventQuery.error.status === 404;
        return (
            <main className={CONTAINER}>
                <div className="flex flex-col items-start gap-4 pt-6">
                    <h1 className="text-title-2 text-fg-primary">
                        {notFound ? '이벤트를 찾을 수 없어요' : '이벤트를 불러오지 못했어요'}
                    </h1>
                    <p role="status" className="text-body-sm text-fg-secondary">
                        {notFound
                            ? '끝났거나 취소된 이벤트일 수 있어요. 목록에서 다른 이벤트를 확인해 보세요.'
                            : getErrorMessage(eventQuery.error, '잠시 후 다시 시도해 주세요.')}
                    </p>
                    <div className="flex flex-wrap gap-2">
                        {!notFound && (
                            <Button
                                type="button"
                                variant="secondary"
                                disabled={eventQuery.isFetching}
                                onClick={() => void eventQuery.refetch()}
                            >
                                {eventQuery.isFetching ? '불러오는 중…' : '다시 시도'}
                            </Button>
                        )}
                        <Button variant="secondary" asChild>
                            <Link to="/events">이벤트 목록으로</Link>
                        </Button>
                    </div>
                </div>
            </main>
        );
    }

    /*
     * 등급을 골라 내는 이벤트는 겟또타임 화면이 맡는다 — 여기로 들어오면 돌려보낸다.
     *
     * 이 화면에는 등급 선택이 없어 응모권을 브론즈 1장으로 고정해 보낸다. 가중치 이벤트가
     * 그대로 그려지면 '등급을 골라 최대 N장까지 나눠서 응모'라고 안내해 놓고 1장만 내는 꼴이 된다
     * (2026-10-23 배포본에서 재현).
     *
     * 가중치를 쓰지 않는 응모권 이벤트는 규칙 자체가 브론즈 1장이라 이 화면이 맞다 — 돌려보내지 않는다.
     *
     * 목록·홈은 래플을 /time-raffle로 보내지만, 서버 알림의 linkUrl이 /events/{id}를 쓰고
     * 주소를 직접 칠 수도 있어 실제로 들어온다. 발표 결과 경로(/events/{id}/results)도
     * 겟또타임 상세가 같은 결과 영역을 보여 주므로 함께 보낸다.
     */
    if (event.eventType === 'TICKET' && event.weightingEnabled) {
        return <Navigate to={`/time-raffle/${id}`} replace />;
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
                    {/*
                     * 운영자가 올린 대표 이미지는 제목 옆에 둔다.
                     *
                     * 본문 폭(1248)만큼 늘이면 권장 크기(IMAGE_GUIDE.EVENT 800×450)가 두 배로
                     * 늘어나 흐려지므로 칸을 400으로 묶는다 — 화면 배율 200%에서 정확히 800이다.
                     * 그만큼 좁은 그림을 위에 쌓으면 제목이 첫 화면에서 밀려나므로 옆으로 세운다.
                     */}
                    <div className="mt-2 flex flex-col gap-5 sm:flex-row sm:items-center">
                        {hero.shown && (
                            <div className="bg-surface-sunken aspect-video w-full max-w-100 shrink-0 overflow-hidden rounded-2xl">
                                <img
                                    src={event.bannerImageUrl!}
                                    alt=""
                                    onError={hero.onError}
                                    className="size-full object-cover"
                                />
                            </div>
                        )}

                        <div className="flex min-w-0 flex-col">
                            {/*
                             * 목록에서 바로 들어오는 최상위 화면이라 겟또타임·미션 상세와 같은 title-1을 쓴다.
                             * title-2는 마이페이지가 여는 하위 화면(PageHeader) 크기다
                             */}
                            <h1 className="text-title-1 text-fg-primary">{event.title}</h1>

                            <p className="text-body-sm text-fg-tertiary mt-2">
                                {formatYmd(event.startsAt)} ~ {formatYmd(event.endsAt)}
                            </p>
                        </div>
                    </div>

                    <hr className="border-border-default mt-6" />

                    <div className="mt-10">
                        <EventDetailBody event={event} />
                    </div>
                </>
            )}

            {/*
             * 발표 영역 — 마감 뒤에만 선다. 발표 전에는 대기 카드, 공개된 뒤에는 당첨자 명단이다.
             * 겟또타임 상세와 같은 위젯을 쓴다 — 발표 전 비노출·마스킹 규칙이 갈라지면 안 된다 (ADR-022)
             */}
            {event.status === 'canceled' && (
                <p role="status" className="mt-6">
                    이벤트가 취소됐습니다. 차감한 응모권은 원래 등급으로 반환됩니다.
                </p>
            )}
            {isAfterClose && event.status !== 'canceled' && (
                <div className="mt-10">
                    {results && (
                        <DrawResultSection
                            results={results}
                            myResult={myResult}
                            prizeImageUrl={event.bannerImageUrl}
                        />
                    )}
                </div>
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
                balanceByGrade={ticket?.countByGrade ?? null}
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
