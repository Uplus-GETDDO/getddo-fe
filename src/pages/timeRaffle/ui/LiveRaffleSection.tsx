import type { Event } from '@entities/event';

import { Badge } from '@shared/ui/badge';
import { Pager } from '@shared/ui/pager';

import { usePagedList } from '../hooks/usePagedList';
import { LiveRaffleCard } from './LiveRaffleCard';
import { PagedCardGrid } from './PagedCardGrid';
import { RaffleCompactCard } from './RaffleCompactCard';

/** 대표 카드 아래 작은 카드를 한 쪽에 몇 개 둘지 — 두 줄(2열 × 2)까지 */
const COMPACT_PAGE_SIZE = 4;

interface LiveRaffleSectionProps {
    /** 페이지 안 이동 위치 */
    id?: string;
    /** 마감이 임박한 순서로 정렬된 진행 중 래플 */
    events: Event[];
    now: Date;
    /** ADR-010 누적 한도 */
    ticketLimit: number;
}

/**
 * 지금 진행 중인 래플.
 *
 * 마감이 가장 가까운 하나를 크게 두고 나머지는 작은 카드로 함께 보여 준다.
 * 작은 카드가 한 쪽(4개)을 넘으면 제목 줄 오른쪽 화살표로 넘긴다 — 끝없이 쌓이면 아래 오픈 예정이 밀려 보이지 않았다.
 * 대표는 운영자가 고르거나 무작위로 바꾸지 않고 '마감 임박'이라는 하나의 기준으로 정한다 — 기준을 제목 옆에 적어
 * 특정 래플을 밀어 주는 것처럼 보이지 않게 하고, 새로고침마다 카드가 바뀌어 찾던 래플을 놓치는 일도 없게 한다.
 */
export function LiveRaffleSection({ id, events, now, ticketLimit }: LiveRaffleSectionProps) {
    const [first, ...rest] = events;
    const page = usePagedList(rest, COMPACT_PAGE_SIZE);

    return (
        <section id={id} className="flex scroll-mt-24 flex-col gap-6">
            <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                    <h2 className="text-title-3 text-fg-primary">지금 진행 중</h2>
                    {events.length > 0 && (
                        <Badge variant="neutral" size="sm">
                            {events.length}
                        </Badge>
                    )}
                    {events.length > 1 && (
                        <span className="text-caption text-fg-tertiary">마감이 가까운 순</span>
                    )}
                </div>
                {page.total > 1 && (
                    <Pager
                        size="md"
                        current={page.current}
                        total={page.total}
                        onPrev={page.prev}
                        onNext={page.next}
                        prevDisabled={page.current === 0}
                        nextDisabled={page.current === page.total - 1}
                        prevLabel="이전 진행 중 래플"
                        nextLabel="다음 진행 중 래플"
                    />
                )}
            </div>

            {first ? (
                <div className="flex flex-col gap-4">
                    <LiveRaffleCard event={first} />
                    {page.items.length > 0 && (
                        <PagedCardGrid
                            items={page.items}
                            pageKey={page.current}
                            direction={page.direction}
                            animate={page.moved}
                            renderItem={(event, wide) => (
                                <RaffleCompactCard
                                    key={event.id}
                                    event={event}
                                    phase="live"
                                    now={now}
                                    ticketLimit={ticketLimit}
                                    wide={wide}
                                />
                            )}
                        />
                    )}
                </div>
            ) : (
                <p className="text-body-sm text-fg-tertiary">지금 진행 중인 래플이 없어요.</p>
            )}
        </section>
    );
}
