import { useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { toast } from 'sonner';

import type { EntryTickets, TicketsByGrade } from '@entities/entry';
import type { Event } from '@entities/event';

import { useEventResults, useMyResult } from '@entities/drawResult';
import { useEntryEligibility } from '@entities/entry';
import { useEvent } from '@entities/event';
import { ticketGradeSchema, useMyTickets } from '@entities/ticket';
import { useEnterEvent } from '@features/enterEvent';
import { getErrorMessage } from '@shared/api/errorMessage';
import { Button } from '@shared/ui/button';
import { SkeletonDetail } from '@shared/ui/skeleton';
import {
    EntryCompleteDialog,
    EntryConfirmDialog,
    InsufficientTicketsDialog,
    readEligibility,
} from '@widgets/eventEntry';

import { BronzeOnlyTicket } from './ui/BronzeOnlyTicket';
import { DrawResultSection } from './ui/DrawResultSection';
import { GradeTicketSteppers } from './ui/GradeTicketSteppers';
import { MyResultCard } from './ui/MyResultCard';
import { MyTicketCard } from './ui/MyTicketCard';
import { RaffleDetailHero } from './ui/RaffleDetailHero';
import { RaffleDetailsCard } from './ui/RaffleDetailsCard';
import { RaffleRulesCard } from './ui/RaffleRulesCard';
import { TicketSelectHeader } from './ui/TicketSelectHeader';

const CONTAINER = 'mx-auto w-full max-w-312 px-6 pb-28';

/** 응모도 결과 확인도 할 수 없는 상태에서 버튼에 대신 표시하는 문구 */
const STATUS_LABEL: Record<Event['status'], string> = {
    open: '응모하기',
    upcoming: '오픈 예정',
    closed: '결과 발표 대기',
    drawn: '발표 완료',
};

export function TimeRaffleDetailPage() {
    const { id = '' } = useParams();
    const { data: event, isPending, isError } = useEvent(id);
    const { data: ticket } = useMyTickets();
    // 응모 자격은 서버 판정으로 받는다 — 진행 중일 때만 조회한다 (E07)
    const { data: eligibility } = useEntryEligibility(id, {
        enabled: event?.status === 'open',
    });
    // 마감 전에는 결과가 존재하지 않으므로 묻지 않는다
    const isAfterClose = event?.status === 'closed' || event?.status === 'drawn';
    const { data: results } = useEventResults(id, isAfterClose);
    // 본인 결과도 마감 후에만 묻는다 — 공개 전에는 서버가 PENDING으로 고정해 돌려준다
    const { data: myResult } = useMyResult(id, isAfterClose);
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

    if (isPending) {
        return (
            <main className={CONTAINER}>
                <SkeletonDetail />
            </main>
        );
    }

    if (isError) {
        return (
            <main className={CONTAINER}>
                <p className="text-destructive text-body-sm">래플을 불러오지 못했습니다.</p>
            </main>
        );
    }

    const isOpen = event.status === 'open';
    const isFree = event.eventType === 'NO_TICKET';
    const isWeighted = event.eventType === 'TICKET' && event.weightingEnabled;
    const selectedTotal = tickets.BRONZE + tickets.SILVER + tickets.GOLD + tickets.PLATINUM;

    // 자격 판정이 아직 안 왔으면 이벤트 카운터로 근사한다 — 서버 판정(E07)이 오면 그 값을 따른다
    const alreadyUsed =
        eligibility?.usedTicketCount ??
        event.myTicketCount ??
        (event.myEntryCount ?? 0) * event.requiredTickets;
    const remainingLimit =
        eligibility?.remainingTicketLimit ??
        (event.maxTicketsPerUser == null
            ? null
            : Math.max(0, event.maxTicketsPerUser - alreadyUsed));
    // 자격 사유를 세 갈래로 읽는 규칙은 이벤트 상세와 같아야 하므로 한곳에 둔다 (E07)
    const { completed, forbidden, lacking } = readEligibility(eligibility);
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

    // 잔액을 아직 못 받았으면 부족하다고 단정하지 않고 확인 모달로 보낸다 (최종 판정은 서버 응답).
    // 서버가 이미 부족을 판정했으면 로컬 잔액과 무관하게 부족 안내로 보낸다
    const hasEnoughTickets =
        !lacking &&
        (ticket == null ||
            isFree ||
            (isWeighted
                ? ticketGradeSchema.options.every(
                      (grade) => tickets[grade] <= ticket.countByGrade[grade],
                  )
                : ticket.countByGrade.BRONZE >= 1));
    // 확인 모달은 응모 후 남는 전체 응모권을 보인다 — 브론즈만 쓰는 래플이어도 전체에서 그만큼 줄어든다
    const dialogBalance = ticket?.availableCount ?? null;

    return (
        <main className={CONTAINER}>
            <div className="flex flex-col gap-10">
                <RaffleDetailHero
                    event={event}
                    quantityControl={
                        !isOpen || isFree ? undefined : (
                            // 브론즈만 받는 래플도 같은 제목·(?) 안내를 둔다 — 왜 실버·골드를 못 쓰는지 같은 자리에서 알린다
                            <div className="flex flex-col gap-4">
                                <TicketSelectHeader
                                    gradeReflected={isWeighted}
                                    remainingLimit={remainingLimit}
                                />
                                {isWeighted ? (
                                    <GradeTicketSteppers
                                        value={tickets}
                                        onChange={setTickets}
                                        availableByGrade={ticket?.countByGrade ?? null}
                                        remainingLimit={remainingLimit}
                                    />
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
                                disabled={!canEnter || needsSelection}
                                onClick={() =>
                                    hasEnoughTickets ? setConfirmOpen(true) : setShortfallOpen(true)
                                }
                                className="w-full"
                            >
                                {completed
                                    ? '응모 완료'
                                    : forbidden
                                      ? '응모할 수 없어요'
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
                {/* 발표 전에는 발표 대기 카드가, 발표 후에는 결과 영역의 배너가 본인 결과를 맡는다 */}
                {(myResult?.result === 'PENDING' ||
                    (event.status === 'closed' && !results?.isPublished)) && (
                    <MyResultCard entered={myResult?.result === 'PENDING'} />
                )}
                {results && (
                    <DrawResultSection event={event} results={results} myResult={myResult} />
                )}
                <MyTicketCard event={event} />
                <RaffleDetailsCard event={event} />
                <RaffleRulesCard event={event} />
            </div>

            <EntryConfirmDialog
                open={confirmOpen}
                onOpenChange={setConfirmOpen}
                title={event.title}
                tickets={requestedTickets}
                balance={dialogBalance}
                returnFocusTo={entryButtonRef}
                pending={enterEvent.isPending}
                onConfirm={() => {
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
