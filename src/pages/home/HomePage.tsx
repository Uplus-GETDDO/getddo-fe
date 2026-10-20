import { ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';

import { EventResultRow, useEventList } from '@entities/event';
import { Button } from '@shared/ui/button';
import { BannerSlider } from '@widgets/bannerSlider';
import { EventCardList } from '@widgets/eventCardList';
import { TicketBalanceWidget } from '@widgets/ticketBalance';
import { TicketEventSection } from '@widgets/ticketEventSection';

import { myAwaitingResults } from './utils/homeSections';

/** 피그마 홈 본문 폭 1200 (좌우 여백 24 포함 1248) — 헤더와 같은 폭 */
const CONTAINER = 'mx-auto w-full max-w-312 px-6';

/** 응모권 없이 참여할 이벤트·발표 대기·결과는 한 줄(4개)까지만 보여주고 나머지는 '더보기'로 넘긴다 */
const FREE_EVENT_LIMIT = 4;
const RESULT_LIMIT = 4;

export function HomePage() {
    const { data: events, isPending, isError } = useEventList();

    // 겟또타임 섹션에는 겟또타임만, 이벤트 섹션에는 겟또타임이 아닌 응모권 미사용 이벤트만 둔다
    const timeRaffles = (events ?? []).filter((event) => event.isTimeRaffle);
    const freeEvents = (events ?? []).filter(
        (event) => !event.isTimeRaffle && event.requiredTickets === 0,
    );
    const resultEvents = myAwaitingResults(events ?? []);

    return (
        // 피그마 홈 간격 — 헤더 아래 64(UserLayout이 준다), 섹션 사이 80, 섹션 제목과 내용 24. 마지막 섹션과 푸터는 다른 화면과 같은 112(pb-28)
        <main className="flex w-full flex-col gap-20 pb-28">
            <div className={`${CONTAINER} flex flex-col gap-20`}>
                <BannerSlider />
                <TicketEventSection events={timeRaffles} isPending={isPending} isError={isError} />
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
                    emptyMessage="지금 참여할 수 있는 이벤트가 없어요."
                />
                {resultEvents.length > 0 && (
                    <section className="flex flex-col gap-6">
                        <div className="flex items-center justify-between">
                            <h2 className="text-title-3 text-fg-primary">발표 대기 · 결과</h2>
                            {/* 내 응모만 추렸으니 더 보는 곳도 이벤트 목록이 아니라 내 응모 내역이다 */}
                            <Button asChild variant="link" size="text">
                                <Link to="/my-entries">
                                    더보기
                                    <ChevronRight />
                                </Link>
                            </Button>
                        </div>
                        {/* 피그마 홈 — 바깥 테두리 없이 행 사이에만 구분선, 4개까지 보여주고 나머지는 '더보기'. 구분선은 호버 배경과 같은 8px 안쪽에서 시작해 좌우 끝을 맞춘다 */}
                        <div className="[&>*+*]:before:bg-border-default flex flex-col [&>*+*]:relative [&>*+*]:before:absolute [&>*+*]:before:inset-x-2 [&>*+*]:before:top-0 [&>*+*]:before:h-px">
                            {resultEvents.slice(0, RESULT_LIMIT).map((event) => (
                                <EventResultRow key={event.id} event={event} />
                            ))}
                        </div>
                    </section>
                )}
            </div>
        </main>
    );
}
