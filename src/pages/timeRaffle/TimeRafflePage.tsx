import { motion } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import { useEventList } from '@entities/event';
import { useVirtualClock } from '@shared/model/virtualClock';
import { LoadError } from '@shared/ui/load-error';
import { RefreshStatus } from '@shared/ui/refresh-status';
import { LoadingBlock, Skeleton, SkeletonCard, SkeletonHeading } from '@shared/ui/skeleton';

import { RAFFLE_SECTION_IDS } from './model/sectionIds';
import { ClosedRaffleList } from './ui/ClosedRaffleList';
import { LiveRaffleSection } from './ui/LiveRaffleSection';
import { TimeRaffleHero } from './ui/TimeRaffleHero';
import { TimeRaffleTrustNotice } from './ui/TimeRaffleTrustNotice';
import { UpcomingRaffleSection } from './ui/UpcomingRaffleSection';

const CONTAINER = 'mx-auto w-full max-w-312 px-6 pb-28';

/** ADR-010 — 가중치 적용 이벤트는 사용자·이벤트별 누적 5장까지만 쓸 수 있다 */
const ENTRY_TICKET_LIMIT = 5;

type RaffleView = 'now' | 'closed';

/** 주소의 ?view= 값 — 마감한 래플 화면은 'closed', 그 밖은 기본 화면 */
const VIEW_PARAM = 'view';

export function TimeRafflePage() {
    const eventsQuery = useEventList();
    const { data: events, isPending } = eventsQuery;
    const clock = useVirtualClock();
    // 날짜 머리말('오늘/어제') 표기 전용이라 마운트 시각으로 충분하다 — 마감 판정에는 쓰지 않는다
    const [now] = useState(() => clock.now());

    // 마감한 래플은 페이지를 옮기지 않고 아래 내용 칸만 바꿔 보여 준다. 상태를 주소에 담아
    // 뒤로가기로 기본 화면에 돌아오고, 링크로 바로 마감 화면을 열 수 있게 한다
    const [searchParams, setSearchParams] = useSearchParams();
    const view: RaffleView = searchParams.get(VIEW_PARAM) === 'closed' ? 'closed' : 'now';
    // 칸을 바꾼 뒤 내려갈 곳 — 바꾸기 전에는 그 섹션이 화면에 없어 렌더가 끝난 뒤 스크롤한다
    const pendingScroll = useRef<string | null>(null);
    // 처음 들어왔을 때는 움직이지 않는다 — 진행 중 카드가 밀려 들어오면 정보가 늦게 읽힌다. 전체보기·뒤로로 바꿀 때만 민다
    const [slideOnSwitch, setSlideOnSwitch] = useState(false);

    const scrollTo = (target: string) => {
        document.getElementById(target)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };

    useEffect(() => {
        if (!pendingScroll.current) return;
        scrollTo(pendingScroll.current);
        pendingScroll.current = null;
    }, [view]);

    const changeView = (next: RaffleView, target: string) => {
        if (next === view) {
            scrollTo(target);
            return;
        }
        pendingScroll.current = target;
        setSlideOnSwitch(true);
        setSearchParams(next === 'closed' ? { [VIEW_PARAM]: 'closed' } : {});
    };

    if (isPending) {
        return (
            // 페이지 모양을 아는 화면이라 스켈레톤 — 머리 배너, 지금 진행 중 제목·대표 카드·작은 카드
            <main className={CONTAINER}>
                <LoadingBlock>
                    <div aria-hidden className="flex flex-col gap-14">
                        <Skeleton className="h-72 w-full rounded-3xl" />
                        <div className="flex flex-col gap-6">
                            <SkeletonHeading caption />
                            <SkeletonCard className="h-64" />
                            <div className="grid gap-6 md:grid-cols-2">
                                <SkeletonCard className="h-40" />
                                <SkeletonCard className="h-40" />
                            </div>
                        </div>
                    </div>
                </LoadingBlock>
            </main>
        );
    }

    const raffles = (events ?? []).filter((event) => event.isTimeRaffle);
    const liveRaffles = raffles.filter((event) => event.status === 'open');
    const upcomingRaffles = raffles.filter((event) => event.status === 'upcoming');
    // 마감 이후는 한 목록에 두되 줄마다 발표 대기·발표 완료를 적는다 (시안 '마감한 래플')
    const closedRaffles = raffles.filter((event) =>
        ['closed', 'drawn', 'canceled', 'ended'].includes(event.status),
    );

    // 마감이 임박한 래플을 먼저 보여 준다.
    // 같은 시각을 소수점 자리수만 다르게 받으면 문자열 비교가 어긋나므로 시각으로 비교한다
    const byEndsAtAsc = [...liveRaffles].sort(
        (a, b) => new Date(a.endsAt).getTime() - new Date(b.endsAt).getTime(),
    );
    const byOpensAtAsc = [...upcomingRaffles].sort(
        (a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime(),
    );
    // 마감 목록은 최근에 끝난 것이 위로 온다
    const byEndsAtDesc = [...closedRaffles].sort(
        (a, b) => new Date(b.endsAt).getTime() - new Date(a.endsAt).getTime(),
    );

    return (
        <main className={CONTAINER}>
            {/* 머리 배너와 첫 섹션 사이는 미션 페이지(오늘의 적립 → 출석체크)와 같은 56 */}
            <div className="flex flex-col gap-14">
                <TimeRaffleHero
                    live={events ? byEndsAtAsc : null}
                    now={now}
                    refresh={
                        // 30초 폴링 중임을 알리고, 실패하면 받아 둔 목록을 둔 채 다시 시도를 연다 (홈 겟또타임과 같은 표시).
                        // 받아 둔 목록이 없으면 아래 실패 칸이 다시 시도를 맡으니 두지 않는다
                        events && (
                            <RefreshStatus
                                fetching={eventsQuery.isFetching}
                                updatedAt={eventsQuery.dataUpdatedAt}
                                error={eventsQuery.isError}
                                onRefresh={() => void eventsQuery.refetch()}
                            />
                        )
                    }
                />

                {/*
                 * 머리 아래 내용 칸만 갈아 끼운다 — 마감 화면은 옆에서 밀려 들어오고, 돌아가면 반대쪽에서 들어온다.
                 * 거르기 탭이 아니라 '전체보기'로 들어갔다 '뒤로'로 나오는 한 겹 아래 화면이다
                 */}
                <motion.div
                    key={view}
                    initial={
                        slideOnSwitch ? { opacity: 0, x: view === 'closed' ? 24 : -24 } : false
                    }
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.25, ease: 'easeOut' }}
                    // 섹션 사이는 홈·미션과 같은 80 (머리와 첫 섹션은 미션처럼 56)
                    className="flex flex-col gap-20"
                >
                    {/*
                     * 처음부터 못 받았을 때는 머리·안내 같은 틀은 두고 목록 자리에만 실패 칸을 둔다.
                     * 받아 둔 목록이 있으면 다시 받기에 실패해도 그대로 두고 머리의 갱신 표시로만 알린다
                     */}
                    {!events ? (
                        <LoadError
                            size="md"
                            title="겟또타임을 불러오지 못했어요"
                            onRetry={() => void eventsQuery.refetch()}
                            retrying={eventsQuery.isFetching}
                            className="border-border-default min-h-80 rounded-2xl border"
                        />
                    ) : view === 'closed' ? (
                        <ClosedRaffleList
                            id={RAFFLE_SECTION_IDS.closed}
                            events={byEndsAtDesc}
                            now={now}
                            mode="full"
                            onBack={() => changeView('now', RAFFLE_SECTION_IDS.closed)}
                        />
                    ) : (
                        <>
                            <LiveRaffleSection
                                id={RAFFLE_SECTION_IDS.live}
                                events={byEndsAtAsc}
                                now={now}
                                ticketLimit={ENTRY_TICKET_LIMIT}
                            />

                            <UpcomingRaffleSection
                                id={RAFFLE_SECTION_IDS.upcoming}
                                events={byOpensAtAsc}
                                now={now}
                                ticketLimit={ENTRY_TICKET_LIMIT}
                            />

                            <ClosedRaffleList
                                id={RAFFLE_SECTION_IDS.closed}
                                events={byEndsAtDesc}
                                now={now}
                                mode="preview"
                                onShowAll={() => changeView('closed', RAFFLE_SECTION_IDS.closed)}
                            />
                        </>
                    )}
                </motion.div>

                <div className="mt-6">
                    <TimeRaffleTrustNotice />
                </div>
            </div>
        </main>
    );
}
