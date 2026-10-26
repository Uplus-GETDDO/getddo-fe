import { useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { toast } from 'sonner';

import type { EntryTickets, TicketsByGrade } from '@entities/entry';
import type { Event } from '@entities/event';

import { useEventResults, useMyResult } from '@entities/drawResult';
import { useEntryEligibility, useEntryStatistics, useMyEventEntries } from '@entities/entry';
import { useEvent } from '@entities/event';
import { TicketBalanceStatus, ticketGradeSchema, useMyTickets } from '@entities/ticket';
import { useEnterEvent } from '@features/enterEvent';
import { getErrorMessage } from '@shared/api/errorMessage';
import { getPollingRetryDelay } from '@shared/api/queryPresets';
import { Button } from '@shared/ui/button';
import { SkeletonDetail } from '@shared/ui/skeleton';
import { DrawResultSection } from '@widgets/drawResult';
import {
    EntryCompleteDialog,
    EntryConfirmDialog,
    InsufficientTicketsDialog,
    readEligibility,
} from '@widgets/eventEntry';

import { BronzeOnlyTicket } from './ui/BronzeOnlyTicket';
import { GradeTicketSteppers } from './ui/GradeTicketSteppers';
import { LoseBanner } from './ui/LoseBanner';
import { MyTicketCard } from './ui/MyTicketCard';
import { RaffleDetailHero } from './ui/RaffleDetailHero';
import { RaffleDetailsCard } from './ui/RaffleDetailsCard';
import { RafflePrizeCard } from './ui/RafflePrizeCard';
import { RaffleRulesCard } from './ui/RaffleRulesCard';
import { TicketSelectHeader } from './ui/TicketSelectHeader';
import { WinnerBanner } from './ui/WinnerBanner';

const CONTAINER = 'mx-auto w-full max-w-312 px-6 pb-28';

/** 응모도 결과 확인도 할 수 없는 상태에서 버튼에 대신 표시하는 문구 */
const STATUS_LABEL: Record<Event['status'], string> = {
    open: '응모하기',
    upcoming: '오픈 예정',
    closed: '결과 발표 대기',
    drawn: '발표 완료',
    canceled: '이벤트 취소',
    ended: '추첨 없이 종료',
};

export function TimeRaffleDetailPage() {
    const { id = '' } = useParams();
    const eventQuery = useEvent(id);
    const { data: event, isPending, isError } = eventQuery;
    const ticketsQuery = useMyTickets();
    const ticket = ticketsQuery.data;
    // 응모 자격은 서버 판정으로 받는다 — 진행 중일 때만 조회한다 (E07)
    const { data: eligibility } = useEntryEligibility(id, {
        enabled: event?.status === 'open',
    });
    const { data: myEntries } = useMyEventEntries(id);
    // 응모 현황은 페이지가 한 번만 구독해 히어로·상세 카드에 나눠 준다 — 같은 키의 폴링 observer를 둘 이상 두지 않는다
    const { data: statistics, dataUpdatedAt: statisticsUpdatedAt } = useEntryStatistics(id, {
        isOpen: event?.status === 'open',
    });
    // 마감 전에는 결과가 존재하지 않으므로 묻지 않는다
    const isAfterClose = event != null && !['open', 'upcoming'].includes(event.status);
    const resultsQuery = useEventResults(id, isAfterClose);
    const { data: results } = resultsQuery;
    // 본인 결과도 마감 후에만 묻는다 — 공개 전에는 서버가 PENDING으로 고정해 돌려준다
    const myResultQuery = useMyResult(id, isAfterClose);
    const { data: myResult } = myResultQuery;
    const enterEvent = useEnterEvent(id);
    // 가중치 적용 이벤트에서 사용자가 등급별로 고르는 장수 — 브론즈 0장 사용자를 위해 0장에서 시작한다
    const [tickets, setTickets] = useState<TicketsByGrade>({
        BRONZE: 0,
        SILVER: 0,
        GOLD: 0,
        PLATINUM: 0,
    });
    const [confirmOpen, setConfirmOpen] = useState(false);
    const [shortfallOpen, setShortfallOpen] = useState(false);
    const [completeOpen, setCompleteOpen] = useState(false);
    // 완료 모달이 쓸 값 — 접수 직후에는 이벤트 쿼리가 아직 갱신 전이라 응답 기준으로 계산해 담아 둔다
    const [lastTickets, setLastTickets] = useState<EntryTickets>({});
    const [lastBalance, setLastBalance] = useState<number | null>(null);
    const [lastRemaining, setLastRemaining] = useState<number | null>(0);
    // 모달을 닫으면 방금 누른 응모 버튼으로 포커스를 되돌린다
    const entryButtonRef = useRef<HTMLButtonElement>(null);
    const eventFailureNotice = isError && (
        <div role="status" className="text-body-sm text-fg-secondary">
            <p>
                {event
                    ? '래플 정보를 갱신하지 못했어요. 이전 정보를 표시해요.'
                    : '래플을 불러오지 못했습니다.'}
            </p>
            <p>{getErrorMessage(eventQuery.error, '잠시 후 다시 시도해 주세요.')}</p>
            <Button
                type="button"
                variant="secondary"
                disabled={eventQuery.isFetching}
                onClick={() => void eventQuery.refetch()}
            >
                래플 정보 다시 시도
            </Button>
        </div>
    );

    if (isPending) {
        return (
            <main className={CONTAINER}>
                <SkeletonDetail />
            </main>
        );
    }

    if (isError && !event) {
        return <main className={CONTAINER}>{eventFailureNotice}</main>;
    }

    const isOpen = event.status === 'open';
    const isFree = event.eventType === 'NO_TICKET';
    const isWeighted = event.eventType === 'TICKET' && event.weightingEnabled;
    const selectedTotal = tickets.BRONZE + tickets.SILVER + tickets.GOLD + tickets.PLATINUM;

    // 자격 판정이 아직 안 왔으면 E06 접수 내역 합계로 근사한다 — 서버 판정(E07)이 오면 그 값을 따른다
    const entriesUsed = myEntries?.reduce((sum, entry) => sum + entry.deductedTicketCount, 0);
    const alreadyUsed = eligibility?.usedTicketCount ?? entriesUsed ?? 0;
    const remainingLimit =
        eligibility?.remainingTicketLimit ??
        (event.maxTicketsPerUser == null
            ? null
            : Math.max(0, event.maxTicketsPerUser - alreadyUsed));
    // 자격 사유를 세 갈래로 읽는 규칙은 이벤트 상세와 같아야 하므로 한곳에 둔다 (E07)
    const { completed, forbidden, forbiddenLabel, lacking } = readEligibility(
        eligibility,
        event.membershipRule,
    );
    const canEnter =
        isOpen &&
        !completed &&
        !forbidden &&
        (eligibility === undefined
            ? isFree || (remainingLimit ?? 0) >= 1
            : eligibility.canEnter || lacking);

    // 요청에 실을 장수 맵 — 미사용은 빈 맵, 미적용은 브론즈 1장 고정, 가중치는 등급별 선택
    const requestedTickets: EntryTickets = isFree ? {} : isWeighted ? tickets : { BRONZE: 1 };
    // 가중치 이벤트에서 아무 등급도 고르지 않으면 보낼 요청이 없다
    const needsSelection = isWeighted && selectedTotal < 1;
    const balanceBlocked = !isFree && (!ticket || ticketsQuery.isError || ticketsQuery.isFetching);
    const invalidSelection =
        isWeighted &&
        ticket != null &&
        (ticketGradeSchema.options.some((grade) => tickets[grade] > ticket.countByGrade[grade]) ||
            (remainingLimit !== null && selectedTotal > remainingLimit));
    const balanceLabel = ticketsQuery.isError
        ? '응모권 잔액을 다시 조회해 주세요'
        : '응모권 잔액을 확인하는 중이에요';

    // 조회에 성공한 잔액만 부족 판정에 쓴다. 장애 중에는 확인·제출 모두 차단한다.
    const hasEnoughTickets =
        !lacking &&
        (isFree ||
            (ticket != null &&
                (isWeighted
                    ? ticketGradeSchema.options.every(
                          (grade) => tickets[grade] <= ticket.countByGrade[grade],
                      )
                    : ticket.countByGrade.BRONZE >= 1)));
    // 완료 모달의 남는 총합 계산용 — 확인 모달은 등급별 잔액을 따로 받는다
    const dialogBalance = ticket?.availableCount ?? null;
    const submitBlocked =
        balanceBlocked || needsSelection || invalidSelection || !canEnter || !hasEnoughTickets;

    return (
        <main className={CONTAINER}>
            <div className="flex flex-col gap-10">
                {eventFailureNotice}
                {!confirmOpen && <TicketBalanceStatus query={ticketsQuery} />}
                <RaffleDetailHero
                    event={event}
                    statistics={statistics}
                    statisticsUpdatedAt={statisticsUpdatedAt}
                    quantityControl={
                        !isOpen || isFree ? undefined : (
                            // 브론즈만 받는 래플도 같은 제목·(?) 안내를 둔다 — 왜 실버·골드를 못 쓰는지 같은 자리에서 알린다
                            <div className="flex flex-col gap-4">
                                <TicketSelectHeader
                                    gradeReflected={isWeighted}
                                    remainingLimit={remainingLimit}
                                />
                                {isWeighted ? (
                                    <fieldset disabled={balanceBlocked} className="min-w-0">
                                        <GradeTicketSteppers
                                            value={tickets}
                                            onChange={setTickets}
                                            availableByGrade={ticket?.countByGrade ?? null}
                                            remainingLimit={remainingLimit}
                                        />
                                    </fieldset>
                                ) : (
                                    // 등급 미반영 래플은 브론즈 1장 고정이라 고를 수량이 없다
                                    <BronzeOnlyTicket owned={ticket?.countByGrade.BRONZE ?? null} />
                                )}
                            </div>
                        )
                    }
                    cta={
                        isOpen ? (
                            <Button
                                ref={entryButtonRef}
                                size="lg"
                                disabled={
                                    !canEnter ||
                                    balanceBlocked ||
                                    needsSelection ||
                                    invalidSelection ||
                                    enterEvent.isPending
                                }
                                onClick={() =>
                                    !balanceBlocked &&
                                    (hasEnoughTickets
                                        ? setConfirmOpen(true)
                                        : setShortfallOpen(true))
                                }
                                className="w-full"
                            >
                                {completed
                                    ? '응모 완료'
                                    : forbidden
                                      ? (forbiddenLabel ?? '응모할 수 없어요')
                                      : balanceBlocked
                                        ? balanceLabel
                                        : invalidSelection
                                          ? '응모 수량을 다시 확인해 주세요'
                                          : needsSelection
                                            ? '응모권을 골라주세요'
                                            : alreadyUsed > 0
                                              ? '추가 응모하기'
                                              : '응모하기'}
                            </Button>
                        ) : (
                            // 진행 중이 아니면 상태를 비활성 버튼으로 알린다 — 발표가 끝난 래플도 시안처럼 '발표 완료'를 둔다
                            <Button disabled size="lg" className="w-full">
                                {STATUS_LABEL[event.status]}
                            </Button>
                        )
                    }
                />
                {/* 결과는 발표되면 바뀌지 않아 조회 시각·받는 중은 보이지 않는다 — 실패했을 때만 한 줄로 알리고 다시 시도를 연다.
                    받아 둔 결과가 있으면 그대로 둔다. 취소된 이벤트는 결과가 없어 알리지 않는다 */}
                {isAfterClose &&
                    event.status !== 'canceled' &&
                    (
                        [
                            ['당첨자 명단', '당첨자 명단을', resultsQuery],
                            ['내 결과', '내 결과를', myResultQuery],
                        ] as const
                    ).map(([label, object, query]) => {
                        const retryDelay = getPollingRetryDelay(query.error ?? query.failureReason);
                        if (!query.isError && retryDelay === 0) return null;
                        return (
                            <div
                                key={label}
                                role="status"
                                className="text-body-sm text-fg-secondary flex flex-wrap items-center gap-x-3 gap-y-1"
                            >
                                <p>
                                    {retryDelay > 0
                                        ? `요청이 많아 ${object} 잠시 후 다시 불러올게요.`
                                        : query.data
                                          ? `${object} 새로 불러오지 못해 이전 결과를 보여 주고 있어요.`
                                          : `${object} 불러오지 못했어요.`}
                                </p>
                                <Button
                                    type="button"
                                    variant="secondary"
                                    size="sm"
                                    disabled={query.isFetching || retryDelay > 0}
                                    onClick={() => {
                                        if (retryDelay === 0)
                                            void query.refetch({ cancelRefetch: false });
                                    }}
                                >
                                    {label} 다시 불러오기
                                </Button>
                            </div>
                        );
                    })}
                {/* 발표 대기·추첨 없음·취소·당첨자 명단은 결과 영역이 스스로 가른다 (GD-247과 합침) */}
                {event.status === 'canceled' && (
                    <p role="status">
                        이벤트가 취소됐습니다. 차감한 응모권은 원래 등급으로 반환됩니다.
                    </p>
                )}
                {results && event.status !== 'canceled' && (
                    <DrawResultSection
                        results={results}
                        myResult={myResult}
                        prizeImageUrl={event.bannerImageUrl}
                        // 래플은 당첨·낙첨을 큰 연출로 알린다 — 결과를 보러 들어오는 화면이다
                        banner={
                            myResult?.result === 'WON' ? (
                                <WinnerBanner prize={myResult.prize} />
                            ) : myResult?.result === 'LOST' ? (
                                <LoseBanner event={event} />
                            ) : undefined
                        }
                    />
                )}
                <MyTicketCard event={event} />
                {/* 경품 그림은 상세 안내의 '상품 구성' 한 줄보다 먼저 와야 무엇을 받는지 바로 보인다 */}
                <RafflePrizeCard event={event} />
                <RaffleDetailsCard event={event} statistics={statistics} />
                <RaffleRulesCard event={event} />
            </div>

            <EntryConfirmDialog
                open={confirmOpen}
                onOpenChange={setConfirmOpen}
                title={event.title}
                tickets={requestedTickets}
                balanceByGrade={ticket?.countByGrade ?? null}
                returnFocusTo={entryButtonRef}
                pending={enterEvent.isPending}
                disabled={submitBlocked}
                notice={
                    !isFree && (
                        <>
                            <TicketBalanceStatus query={ticketsQuery} />
                            {!balanceBlocked && (invalidSelection || !hasEnoughTickets) && (
                                <p
                                    role="status"
                                    className="text-body-sm text-semantic-error-strong"
                                >
                                    응모 수량을 다시 확인해 주세요. 취소한 뒤 수량을 조정해 주세요.
                                </p>
                            )}
                        </>
                    )
                }
                onConfirm={() => {
                    if (submitBlocked) return;
                    enterEvent.mutate(requestedTickets, {
                        onSuccess: (entry) => {
                            setConfirmOpen(false);
                            setLastTickets(requestedTickets);
                            setLastBalance(
                                dialogBalance === null
                                    ? null
                                    : Math.max(0, dialogBalance - entry.deductedTicketCount),
                            );
                            setLastRemaining(
                                // 미사용 이벤트는 장수와 무관하게 사용자당 1회라 더 낼 수 없다
                                isFree
                                    ? 0
                                    : remainingLimit === null
                                      ? null
                                      : Math.max(0, remainingLimit - entry.deductedTicketCount),
                            );
                            // 한도가 줄어들어 지금 선택이 범위를 벗어날 수 있으므로 되돌린다
                            setTickets({ BRONZE: 0, SILVER: 0, GOLD: 0, PLATINUM: 0 });
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
                bronzeRequired={!isFree && !isWeighted}
                returnFocusTo={entryButtonRef}
            />

            <EntryCompleteDialog
                open={completeOpen}
                onOpenChange={setCompleteOpen}
                title={event.title}
                tickets={lastTickets}
                gradeReflected={isWeighted}
                remainingBalance={lastBalance}
                remainingAllowance={lastRemaining}
                returnFocusTo={entryButtonRef}
            />
        </main>
    );
}
