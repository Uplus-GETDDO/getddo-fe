import { ChevronRight } from 'lucide-react';

import type { AdminEvent } from '@entities/event';

import { ADMIN_STATUS_META } from '@entities/event';
import { badgeVariants } from '@shared/ui/badge';
import { cn } from '@shared/utils/cn';
import { formatKst } from '@shared/utils/date';

/**
 * 이벤트를 고르기 전 첫 화면 — 추첨 관리 대상 이벤트를 카드로 바로 보여 고르는 단계를 줄인다.
 * 손이 먼저 가야 하는 이벤트(재추첨 중·발표 대기·마감)가 앞에 오도록 부모가 정렬해 넘긴다
 */
export function DrawEventPicker({
    events,
    onSelect,
}: {
    events: AdminEvent[];
    onSelect: (eventId: string) => void;
}) {
    return (
        <section aria-labelledby="draw-picker-title" className="flex flex-col gap-3">
            <div className="flex flex-col gap-0.5">
                <h2 id="draw-picker-title" className="text-body-bold text-fg-primary">
                    관리할 이벤트
                </h2>
                <p className="text-caption text-fg-tertiary">
                    마감 이후 이벤트 {events.length}개 · 발표가 필요한 이벤트가 먼저 보여요
                </p>
            </div>
            <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {events.map((event) => {
                    const status = ADMIN_STATUS_META[event.status];
                    const winners = event.prizes.reduce((sum, p) => sum + p.winnerCount, 0);
                    return (
                        <li key={event.id}>
                            <button
                                type="button"
                                onClick={() => onSelect(event.id)}
                                className="group bg-surface-page border-border-default hover:border-fg-brand hover:ring-fg-brand focus-visible:ring-border-focus flex h-full w-full flex-col gap-3 rounded-2xl border p-5 text-left transition-colors hover:ring-1 focus-visible:ring-2 focus-visible:outline-none"
                            >
                                <span className="flex items-center gap-2">
                                    <span
                                        className={cn(
                                            badgeVariants({ variant: null }),
                                            status.chipClass,
                                        )}
                                    >
                                        {status.label}
                                    </span>
                                    <ChevronRight
                                        aria-hidden
                                        className="text-fg-tertiary group-hover:text-fg-primary ml-auto size-5 transition-colors"
                                    />
                                </span>
                                <span className="text-body-bold text-fg-primary line-clamp-2">
                                    {event.title}
                                </span>
                                <span className="text-caption text-fg-tertiary mt-auto flex flex-wrap gap-x-3 tabular-nums">
                                    <span>{formatKst(event.endsAt)} 마감</span>
                                    <span>당첨 {winners}명</span>
                                </span>
                            </button>
                        </li>
                    );
                })}
            </ul>
        </section>
    );
}
