import { ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';

import type { Event } from '@entities/event';

import { EventCard } from '@entities/event';
import { Button } from '@shared/ui/button';
import { LoadError } from '@shared/ui/load-error';
import { SkeletonCard } from '@shared/ui/skeleton';

export function EventCardList({
    title,
    description,
    moreHref,
    moreLabel = '더보기',
    events,
    isPending,
    isError,
    onRetry,
    emptyMessage = '표시할 이벤트가 없습니다.',
}: {
    title: string;
    /** 제목 옆 작은 설명 — 다른 홈 섹션과 같은 꼴 */
    description?: string;
    moreHref?: string;
    moreLabel?: string;
    events: Event[];
    isPending?: boolean;
    /** 받아 둔 목록 없이 실패했는가 — 받아 둔 게 있으면 넘기지 않는다 */
    isError?: boolean;
    onRetry?: () => void;
    emptyMessage?: string;
}) {
    return (
        <section className="flex flex-col gap-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-3">
                    <h2 className="text-title-3 text-fg-primary">{title}</h2>
                    {description && (
                        <span className="text-fg-tertiary text-caption">{description}</span>
                    )}
                </div>
                {moreHref && (
                    <Button asChild variant="link" size="text">
                        <Link to={moreHref}>
                            {moreLabel}
                            <ChevronRight />
                        </Link>
                    </Button>
                )}
            </div>
            {/* 불러오는 동안 카드 4장 자리를 잡아 둔다 */}
            {isPending && (
                <div aria-hidden className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    {Array.from({ length: 4 }, (_, index) => (
                        <SkeletonCard key={index} className="h-70" />
                    ))}
                </div>
            )}
            {/* 받아 둔 목록이 없을 때만 오는 실패 — 카드 한 줄 높이를 지켜 아래가 올라오지 않게 한다 */}
            {isError && (
                <LoadError
                    title="이벤트를 불러오지 못했어요"
                    onRetry={onRetry}
                    className="min-h-70"
                />
            )}
            {!isPending && !isError && events.length === 0 && (
                <p className="text-fg-tertiary text-body-sm">{emptyMessage}</p>
            )}
            {events.length > 0 && (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    {events.map((event) => (
                        <Link key={event.id} to={`/events/${event.id}`} className="block">
                            <EventCard event={event} />
                        </Link>
                    ))}
                </div>
            )}
        </section>
    );
}
