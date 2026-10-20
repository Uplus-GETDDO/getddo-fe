import { ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';

import { EventResultRow, useEventList } from '@entities/event';
import { Button } from '@shared/ui/button';
import { EmptyState } from '@shared/ui/empty-state';
import { LoadError } from '@shared/ui/load-error';
import { RefreshStatus } from '@shared/ui/refresh-status';
import { SkeletonRows } from '@shared/ui/skeleton';
import { BannerSlider } from '@widgets/bannerSlider';
import { EventCardList } from '@widgets/eventCardList';
import { LiveEntryRefresh, LiveEntryStatus } from '@widgets/liveEntryStatus';
import { TicketBalanceWidget } from '@widgets/ticketBalance';
import { TicketEventSection } from '@widgets/ticketEventSection';

import { QuickLinks } from './ui/QuickLinks';

/** 피그마 홈 본문 폭 1200 (좌우 여백 24 포함 1248) — 헤더와 같은 폭 */
const CONTAINER = 'mx-auto w-full max-w-312 px-6';

/** 응모권 없이 참여할 이벤트·내 응모 결과는 한 줄(4개)까지만 보여주고 나머지는 '더보기'로 넘긴다 */
const FREE_EVENT_LIMIT = 4;
const RESULT_LIMIT = 4;

export function HomePage() {
    const eventsQuery = useEventList();
    const { data: events, isPending } = eventsQuery;
    // 30초 폴링이 한 번 실패해도 받아 둔 목록은 그대로 보여준다 — 보여줄 게 없을 때만 실패 안내로 바꾼다
    const isError = eventsQuery.isError && !events;

    // 겟또타임 섹션에는 겟또타임만, 이벤트 섹션에는 겟또타임이 아닌 응모권 미사용 이벤트만 둔다
    const timeRaffles = (events ?? []).filter((event) => event.isTimeRaffle);
    const freeEvents = (events ?? []).filter(
        (event) => !event.isTimeRaffle && event.requiredTickets === 0,
    );
    // 멘토링 — 발표 대기·결과는 내가 응모한 것만 (목록 E01의 myEntered)
    const resultEvents = (events ?? []).filter(
        (event) => event.myEntered && (event.status === 'closed' || event.status === 'drawn'),
    );

    return (
        // 피그마 홈 간격 — 헤더 아래 64(UserLayout이 준다), 섹션 사이 80, 섹션 제목과 내용 24. 마지막 섹션과 푸터는 다른 화면과 같은 112(pb-28)
        <main className="flex w-full flex-col gap-20 pb-28">
            <div className={`${CONTAINER} flex flex-col gap-20`}>
                <BannerSlider
                    renderStatus={(event, isActive) => (
                        <LiveEntryStatus
                            eventId={event.id}
                            isOpen={event.status === 'open'}
                            enabled={isActive}
                            winnerCount={event.winnerCount}
                        />
                    )}
                    renderRefresh={(event, isActive) => (
                        <LiveEntryRefresh
                            eventId={event.id}
                            isOpen={event.status === 'open'}
                            enabled={isActive}
                        />
                    )}
                    // 배너 바로 아래 줄(넘김 화살표 왼쪽)에 바로가기 — 게임이 응모권 목록에 섞여 찾기 어렵다는 의견
                    footer={<QuickLinks />}
                />
                <TicketEventSection
                    events={timeRaffles}
                    isPending={isPending}
                    isError={isError}
                    onRetry={() => void eventsQuery.refetch()}
                    refresh={
                        // 폴링 중임을 알리는 표시 — 받는 중엔 아이콘이 돌고, 실패하면 이전 목록을 둔 채 다시 시도를 연다
                        <RefreshStatus
                            fetching={eventsQuery.isFetching}
                            updatedAt={eventsQuery.dataUpdatedAt}
                            error={eventsQuery.isError}
                            onRefresh={() => void eventsQuery.refetch()}
                        />
                    }
                />
            </div>
            <div className={CONTAINER}>
                <TicketBalanceWidget />
            </div>
            <div className={`${CONTAINER} flex flex-col gap-20`}>
                <EventCardList
                    title="이벤트"
                    description="응모권 없이도 참여할 수 있어요."
                    moreHref="/events"
                    moreLabel="더보기"
                    events={freeEvents.slice(0, FREE_EVENT_LIMIT)}
                    isPending={isPending}
                    isError={isError}
                    onRetry={() => void eventsQuery.refetch()}
                    emptyMessage="지금 참여할 수 있는 이벤트가 없어요."
                />
                {/* 응모한 이벤트가 없거나 못 불러와도 섹션은 두고 안내를 보인다 — 있다 없다 하면 홈 아래쪽이 들썩인다 */}
                <section className="flex flex-col gap-6">
                    {/* 다른 홈 섹션처럼 제목 옆에 작은 설명 — 내가 응모한 것만 모았다는 걸 밝힌다 */}
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex flex-wrap items-center gap-3">
                            <h2 className="text-title-3 text-fg-primary">내 응모 결과</h2>
                            <span className="text-fg-tertiary text-caption">
                                내가 응모한 이벤트의 발표 대기와 결과예요.
                            </span>
                        </div>
                        <Button asChild variant="link" size="text">
                            <Link to="/my-entries">
                                더보기
                                <ChevronRight />
                            </Link>
                        </Button>
                    </div>
                    {/* 피그마 홈 — 바깥 테두리 없이 행 사이에만 구분선, 4개까지 보여주고 나머지는 '더보기'. 구분선은 호버 배경과 같은 8px 안쪽에서 시작해 좌우 끝을 맞춘다 */}
                    {isPending ? (
                        <SkeletonRows rows={2} />
                    ) : isError ? (
                        <LoadError
                            title="응모 결과를 불러오지 못했어요"
                            onRetry={() => void eventsQuery.refetch()}
                            retrying={eventsQuery.isFetching}
                        />
                    ) : resultEvents.length === 0 ? (
                        <EmptyState
                            size="sm"
                            title="아직 응모한 이벤트가 없어요"
                            description="응모한 이벤트가 마감되면 발표 대기와 결과를 여기에서 볼 수 있어요."
                        />
                    ) : (
                        <div className="[&>*+*]:before:bg-border-default flex flex-col [&>*+*]:relative [&>*+*]:before:absolute [&>*+*]:before:inset-x-2 [&>*+*]:before:top-0 [&>*+*]:before:h-px">
                            {resultEvents.slice(0, RESULT_LIMIT).map((event) => (
                                <EventResultRow key={event.id} event={event} />
                            ))}
                        </div>
                    )}
                </section>
            </div>
        </main>
    );
}
