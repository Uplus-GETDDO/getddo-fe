import { ChevronRight } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';

import type { Event } from '@entities/event';

import { useEntryStatistics } from '@entities/entry';
import { FeaturedEventCard, UpcomingEventCard } from '@entities/event';
import { Button } from '@shared/ui/button';
import { Card } from '@shared/ui/card';
import { Pager } from '@shared/ui/pager';
import { SkeletonCard } from '@shared/ui/skeleton';
import { cn } from '@shared/utils/cn';

/**
 * 홈 '타임 래플 · 응모권 사용' 섹션 — 좌측에 대표 진행 이벤트 카드,
 * 우측 컨테이너 카드에 오픈 예정 이벤트를 세로로 쌓는다 (그리드 stretch로 양쪽 높이가 맞는다)
 */
export function TicketEventSection({
    events,
    isPending,
    isError,
}: {
    events: Event[];
    isPending?: boolean;
    isError?: boolean;
}) {
    const openEvents = events
        .filter((event) => event.status === 'open')
        .sort((a, b) => new Date(a.endsAt).getTime() - new Date(b.endsAt).getTime());
    const upcomingEvents = events
        .filter((event) => event.status === 'upcoming')
        .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());

    const featured = openEvents[0];

    return (
        <section className="flex flex-col gap-6">
            {/* 다른 홈 섹션처럼 제목 옆에 작은 설명을 둔다 */}
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-3">
                    <h2 className="text-title-3 text-fg-primary">겟또타임</h2>
                    <span className="text-fg-tertiary text-caption">
                        모은 응모권으로 정해진 시간에만 응모할 수 있어요.
                    </span>
                </div>
                <Button asChild variant="link" size="text">
                    <Link to="/time-raffle">
                        더보기
                        <ChevronRight />
                    </Link>
                </Button>
            </div>
            {/* 불러오는 동안 대표 카드·오픈 예정 두 칸 자리를 잡아 둔다 */}
            {isPending && (
                <div aria-hidden className="grid gap-4 lg:grid-cols-2">
                    {Array.from({ length: 2 }, (_, index) => (
                        <SkeletonCard key={index} className="h-72" />
                    ))}
                </div>
            )}
            {isError && (
                <p className="text-destructive text-body-sm">이벤트 목록을 불러오지 못했습니다.</p>
            )}
            {!isPending && !isError && events.length === 0 && (
                <p className="text-fg-tertiary text-body-sm">표시할 이벤트가 없습니다.</p>
            )}
            {(featured || upcomingEvents.length > 0) && (
                <div className="grid items-stretch gap-4 lg:grid-cols-2">
                    {featured && <FeaturedEvent event={featured} />}
                    {upcomingEvents.length > 0 &&
                        (featured ? (
                            // featured 카드가 행 높이를 결정하고 캐러셀은 그 안에서 늘어난다 — 내용물 높이가 행을 밀지 않도록 absolute로 띄운다
                            <Card size="lg" className="relative gap-0 self-stretch py-0">
                                <div className="absolute inset-0 flex flex-col gap-2 overflow-hidden p-(--card-spacing)">
                                    <UpcomingEventCarousel events={upcomingEvents} fillHeight />
                                </div>
                            </Card>
                        ) : (
                            <Card size="lg" className="gap-2 p-(--card-spacing)">
                                <UpcomingEventCarousel events={upcomingEvents} />
                            </Card>
                        ))}
                </div>
            )}
        </section>
    );
}

/** 대표 이벤트의 응모 현황(E03)을 조회해 카드에 내려준다 — 진행 중이므로 30초 폴링 (ADR-0007) */
function FeaturedEvent({ event }: { event: Event }) {
    const { data: statistics } = useEntryStatistics(event.id, { isOpen: true });
    return (
        <FeaturedEventCard
            event={event}
            participantCount={statistics?.participantCount}
            totalSpentTicketCount={statistics?.totalSpentTicketCount}
            mySpentTicketCount={statistics?.mySpentTicketCount}
        />
    );
}

const UPCOMING_PAGE_SIZE = 2;

/** 오픈 예정 이벤트 캐러셀 — 한 화면에 세로로 2장씩, 좌우 버튼으로 페이지 단위 슬라이드한다 */
function UpcomingEventCarousel({
    events,
    fillHeight = false,
}: {
    events: Event[];
    /** 부모 높이가 정해진 컨테이너(featured 카드 옆)에서 카드를 남은 높이로 늘릴지 여부 — 미지정 컨테이너에서 h-full은 높이를 0으로 붕괴시킨다 */
    fillHeight?: boolean;
}) {
    const [page, setPage] = useState(0);
    const totalPages = Math.ceil(events.length / UPCOMING_PAGE_SIZE);
    // 폴링으로 목록이 줄었을 때 현재 페이지가 범위를 벗어나지 않게 보정한다
    const current = Math.min(page, Math.max(totalPages - 1, 0));

    return (
        <>
            <div className="flex items-center justify-between">
                <h3 className="text-body-sm-bold text-fg-primary flex gap-1">
                    오픈 예정
                    <span className="text-fg-tertiary">{events.length}</span>
                </h3>
                {/* 넘길 게 있을 때만 — 제목 줄 오른쪽에 배너와 같은 공용 Pager */}
                {totalPages > 1 && (
                    <Pager
                        size="md"
                        current={current}
                        total={totalPages}
                        prevLabel="이전 오픈 예정"
                        nextLabel="다음 오픈 예정"
                        prevDisabled={current === 0}
                        nextDisabled={current >= totalPages - 1}
                        onPrev={() => setPage(current - 1)}
                        onNext={() => setPage(current + 1)}
                    />
                )}
            </div>
            {/* 행 안쪽 여백(16)만큼 목록을 좌우로 넓혀, 썸네일이 '오픈 예정' 제목과 같은 선에서 시작하게 한다 */}
            <div className={cn('relative -mx-4', fillHeight && 'min-h-0 flex-1')}>
                <div className={cn('overflow-hidden', fillHeight && 'h-full')}>
                    <div
                        className={cn(
                            'flex transition-transform duration-300 ease-out motion-reduce:transition-none',
                            fillHeight && 'h-full',
                        )}
                        style={{ transform: `translateX(-${current * 100}%)` }}
                    >
                        {Array.from({ length: totalPages }, (_, pageIndex) => (
                            <div
                                key={pageIndex}
                                // 화면 밖 슬라이드도 렌더되므로 Tab 포커스·보조 기술 접근을 inert로 차단한다
                                inert={pageIndex !== current}
                                className={cn(
                                    // 피그마 홈 — 한 쪽에 2행 칸을 고정해 1개만 있어도 2개일 때와 같은 높이·위치로 보인다.
                                    // 행 사이 구분선은 호버 배경과 같은 8px 안쪽에서 시작한다
                                    '[&>*+*]:before:bg-border-default grid w-full shrink-0 grid-rows-2 [&>*+*]:relative [&>*+*]:before:absolute [&>*+*]:before:inset-x-2 [&>*+*]:before:top-0 [&>*+*]:before:h-px',
                                    fillHeight && 'h-full',
                                )}
                            >
                                {events
                                    .slice(
                                        pageIndex * UPCOMING_PAGE_SIZE,
                                        (pageIndex + 1) * UPCOMING_PAGE_SIZE,
                                    )
                                    .map((event) => (
                                        <UpcomingEventCard key={event.id} event={event} />
                                    ))}
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </>
    );
}
