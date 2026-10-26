import type { Event } from '@entities/event';

import { Badge } from '@shared/ui/badge';
import { Pager } from '@shared/ui/pager';

import { usePagedList } from '../hooks/usePagedList';
import { PagedCardGrid } from './PagedCardGrid';
import { RaffleCompactCard } from './RaffleCompactCard';

/** 한 쪽에 두는 오픈 예정 카드 수 — 진행 중 작은 카드와 같은 2열 × 2줄 */
const PAGE_SIZE = 4;

/** 오픈 예정 래플 — 여는 시각 순. 진행 중 작은 카드와 같은 카드·같은 두 칸 배치이고, 한 쪽(4개)을 넘으면 제목 줄 오른쪽 화살표로 넘긴다 */
export function UpcomingRaffleSection({
    id,
    events,
    now,
    ticketLimit,
}: {
    id?: string;
    /** 여는 시각이 이른 순으로 정렬된 오픈 예정 래플 */
    events: Event[];
    now: Date;
    /** ADR-010 누적 한도 — 카드의 응모 규칙 문구에 쓴다 */
    ticketLimit: number;
}) {
    const page = usePagedList(events, PAGE_SIZE);

    return (
        <section id={id} className="flex scroll-mt-24 flex-col gap-6">
            <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                    <h2 className="text-title-3 text-fg-primary">오픈 예정</h2>
                    {events.length > 0 && (
                        <Badge variant="neutral" size="sm">
                            {events.length}
                        </Badge>
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
                        prevLabel="이전 오픈 예정 래플"
                        nextLabel="다음 오픈 예정 래플"
                    />
                )}
            </div>
            {events.length === 0 ? (
                <p className="text-body-sm text-fg-tertiary">오픈 예정인 래플이 없어요.</p>
            ) : (
                <PagedCardGrid
                    items={page.items}
                    pageKey={page.current}
                    direction={page.direction}
                    animate={page.moved}
                    renderItem={(event, wide) => (
                        <RaffleCompactCard
                            key={event.id}
                            event={event}
                            phase="upcoming"
                            now={now}
                            ticketLimit={ticketLimit}
                            wide={wide}
                        />
                    )}
                />
            )}
        </section>
    );
}
