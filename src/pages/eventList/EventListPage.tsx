import { useSearchParams } from 'react-router-dom';

import type { Event } from '@entities/event';

import { useEventList } from '@entities/event';
import { ChipTabs, chipTabIds } from '@shared/ui/chip-tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@shared/ui/select';
import { Skeleton } from '@shared/ui/skeleton';

import { EVENT_SORTS, EVENT_TABS, PAGE_SIZE } from './model/eventFilters';
import { EventListCard } from './ui/EventListCard';
import { EventPagination } from './ui/EventPagination';
import { filterEvents, readEventSort, readEventTab } from './utils/filterEvents';

function EventGrid({ events }: { events: Event[] }) {
    return (
        <div className="grid grid-cols-1 gap-x-4 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
            {events.map((event) => (
                <EventListCard key={event.id} event={event} />
            ))}
        </div>
    );
}
/** 탭마다 비어 있는 이유가 달라 문구를 따로 둔다 */
const EMPTY_NOTICE: Record<ReturnType<typeof readEventTab>, string> = {
    open: '진행 중인 이벤트가 없습니다.',
    upcoming: '오픈 예정인 이벤트가 없습니다.',
    past: '지난 이벤트가 없습니다.',
};
/**
 * 이벤트 목록 — 상태 탭(진행 중·오픈 예정·지난 이벤트)과 정렬.
 *
 * 탭·정렬·페이지를 주소에 실어 새로고침·뒤로 가기·링크 공유에서 그대로 열린다.
 *
 * 경품 종류로 거르는 칩과 추천 이벤트 칸은 뺐다 — 무엇을 어느 종류로 볼지, 무엇을 추천으로
 * 볼지가 정해지지 않아 서버가 줄 값이 없다. 기준이 생기면 그때 다시 세운다.
 */
export function EventListPage() {
    const { data: events, isPending, isError } = useEventList();
    const [params, setParams] = useSearchParams();
    const tab = readEventTab(params.get('tab'));
    const sort = readEventSort(params.get('sort'));
    const page = Math.max(1, Number(params.get('page') ?? 1) || 1);
    const { tabId, panelId } = chipTabIds('events', tab);
    // 거르기를 바꾸면 보던 쪽수가 의미를 잃는다 — 페이지만 떨어뜨리고 나머지 조건은 유지한다
    const setParam = (key: string, value: string, fallback: string) => {
        setParams(
            (prev) => {
                const next = new URLSearchParams(prev);
                if (value === fallback) next.delete(key);
                else next.set(key, value);
                next.delete('page');
                return next;
            },
            { replace: true },
        );
    };
    const shown = filterEvents(events ?? [], tab, sort);
    const totalPages = Math.max(1, Math.ceil(shown.length / PAGE_SIZE));
    const paged = shown.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
    const status = isPending ? (
        <div
            aria-hidden
            className="grid grid-cols-1 gap-x-4 gap-y-10 sm:grid-cols-2 lg:grid-cols-4"
        >
            {Array.from({ length: 4 }, (_, index) => (
                <Skeleton key={index} className="h-70 rounded-2xl" />
            ))}
        </div>
    ) : isError ? (
        <p className="text-destructive text-body-sm">이벤트 목록을 불러오지 못했습니다.</p>
    ) : null;
    return (
        <main className="mx-auto flex w-full max-w-312 flex-col px-6 pb-28">
            {/* 탭이 상태를 가르므로 제목은 한 상태를 가리키지 않는다 */}
            <h1 className="text-title-1 text-fg-primary">이벤트</h1>
            <section className="mt-10 flex flex-col gap-6">
                <ChipTabs
                    tabs={EVENT_TABS}
                    value={tab}
                    onValueChange={(next) => setParam('tab', next, 'open')}
                    label="이벤트 상태"
                    idPrefix="events"
                />
                <div className="flex items-center justify-end">
                    <Select value={sort} onValueChange={(next) => setParam('sort', next, 'latest')}>
                        <SelectTrigger className="h-9 shrink-0" aria-label="정렬">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {EVENT_SORTS.map((option) => (
                                <SelectItem key={option.value} value={option.value}>
                                    {option.label}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                <div
                    id={panelId}
                    role="tabpanel"
                    aria-labelledby={tabId}
                    className="flex flex-col gap-6"
                >
                    {status}
                    {!isPending && !isError && paged.length === 0 && (
                        <p className="text-fg-tertiary text-body-sm">{EMPTY_NOTICE[tab]}</p>
                    )}
                    {paged.length > 0 && (
                        <div className="flex flex-col gap-10">
                            <EventGrid events={paged} />
                            <EventPagination
                                page={page}
                                totalPages={totalPages}
                                onPageChange={(next) =>
                                    setParams(
                                        (prev) => {
                                            const updated = new URLSearchParams(prev);
                                            if (next <= 1) updated.delete('page');
                                            else updated.set('page', String(next));
                                            return updated;
                                        },
                                        { replace: true },
                                    )
                                }
                            />
                        </div>
                    )}
                </div>
            </section>
        </main>
    );
}
