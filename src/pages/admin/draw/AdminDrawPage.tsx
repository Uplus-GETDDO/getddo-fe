import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import type { AdminEvent, AdminEventStatus, EventType } from '@entities/event';

import { ADMIN_STATUS_META, useAdminEventsByStatus } from '@entities/event';
import { useRevealWhenStacked } from '@shared/hooks/useRevealWhenStacked';
import { useVirtualClock } from '@shared/model/virtualClock';
import { DateRangeFilter, TextFilter } from '@shared/ui/filter-fields';
import {
    chipValue,
    FilterChips,
    FilterPanel,
    FilterRow,
    rangeValue,
} from '@shared/ui/filter-panel';
import { CardSkeleton, LoadingBlock } from '@shared/ui/skeleton';
import { cn } from '@shared/utils/cn';

import { DrawEventPanel } from './ui/DrawEventPanel';
import { DrawEventPicker } from './ui/DrawEventPicker';

// 마감 이후 추첨 단계(자동 추첨 대기·진행, 확정, 발표, 재추첨)의 이벤트를 관리 대상으로 고른다.
// 마감(CLOSED)도 최초 추첨 실행이 생길 수 있어 포함한다 — 대시보드 '추첨 필요'와 같은 범위
const DRAW_STATUSES: readonly AdminEventStatus[] = [
    'REDRAWING',
    'DRAW_CONFIRMED',
    'CLOSED',
    'PUBLISHED',
];
// 손이 먼저 가야 하는 순서 — 재추첨 중 > 발표 대기 > 마감(추첨 진행) > 발표 완료
const DRAW_PRIORITY: Record<string, number> = {
    REDRAWING: 0,
    DRAW_CONFIRMED: 1,
    CLOSED: 2,
    PUBLISHED: 3,
};
// 이벤트 선택 목록은 단계마다 한 쪽에 담는다 — AE01 최대 크기
const EVENT_PICKER_SIZE = 100;

// 추첨 대상 거르기 — 이벤트·겟또타임은 운영 방식이 달라 먼저 나눈다 (겟또타임 = 응모권 사용 이벤트)
const KIND_OPTIONS: { value: 'all' | EventType; label: string }[] = [
    { value: 'all', label: '전체' },
    { value: 'TICKET', label: '겟또타임' },
    { value: 'NO_TICKET', label: '이벤트' },
];
const HOUR_MS = 60 * 60 * 1000;

/**
 * 발표 대기 칸의 보조 값 — 가장 오래 기다린 이벤트가 추첨 뒤 얼마나 지났는지. 공개가 밀리면 문의로 이어져
 * 무엇부터 처리할지 정하는 데 쓴다. 결과 확정 시각이 응답에 없어 최초 자동 추첨 시각부터 센다
 */
function longestWait(events: AdminEvent[], now: Date): string | null {
    if (events.length === 0) return null;
    const oldest = Math.min(...events.map((e) => new Date(e.drawScheduledAt).getTime()));
    const hours = Math.floor((now.getTime() - oldest) / HOUR_MS);
    if (hours < 1) return null;
    return hours < 24
        ? `가장 오래된 건 ${hours}시간째`
        : `가장 오래된 건 ${Math.floor(hours / 24)}일째`;
}
const STAGE_ORDER: readonly AdminEventStatus[] = [
    'DRAW_CONFIRMED',
    'REDRAWING',
    'CLOSED',
    'PUBLISHED',
];

export function AdminDrawPage() {
    const [searchParams, setSearchParams] = useSearchParams();
    const eventId = searchParams.get('eventId') ?? '';
    const detailRef = useRevealWhenStacked<HTMLElement>(eventId, '(min-width: 1280px)');
    const now = useVirtualClock().now();
    const [kind, setKind] = useState<'all' | EventType>('all');
    const [stage, setStage] = useState<'all' | AdminEventStatus>('all');
    const [keywordInput, setKeywordInput] = useState('');
    const [keyword, setKeyword] = useState('');
    const [createdFrom, setCreatedFrom] = useState('');
    const [createdTo, setCreatedTo] = useState('');
    const createdRangeError = createdFrom !== '' && createdTo !== '' && createdFrom > createdTo;
    // 유형·등록일·검색어는 서버(AE01)가 거른다 — 상태 필터가 하나만 받아 단계마다 따로 불러 합친다.
    // 단계는 늘 네 단계를 모두 받아 칸마다 개수를 세고, 고른 단계는 화면에서 거른다 (단계마다 따로 받은 쪽이라 빠지는 건이 없다)
    const { items, truncated, isPending, isError } = useAdminEventsByStatus(DRAW_STATUSES, {
        page: 1,
        size: EVENT_PICKER_SIZE,
        keyword: keyword || undefined,
        eventType: kind === 'all' ? undefined : kind,
        createdFrom: createdFrom && !createdRangeError ? createdFrom : undefined,
        createdTo: createdTo && !createdRangeError ? createdTo : undefined,
    });
    const filtered =
        kind !== 'all' ||
        stage !== 'all' ||
        keyword !== '' ||
        createdFrom !== '' ||
        createdTo !== '';
    const resetFilters = () => {
        setKind('all');
        setStage('all');
        setKeywordInput('');
        setKeyword('');
        setCreatedFrom('');
        setCreatedTo('');
    };

    // 기간이 잘못되면 날짜 조건 없이 불러온 목록이라 보여 주지 않는다 (기간 입력칸이 오류를 알린다)
    const all = createdRangeError ? [] : [...items];
    const inStage = (status: AdminEventStatus) => all.filter((e) => e.status === status);
    const countOf = (status: AdminEventStatus) => inStage(status).length;
    const events = all
        .filter((e) => stage === 'all' || e.status === stage)
        .sort((a, b) => (DRAW_PRIORITY[a.status] ?? 9) - (DRAW_PRIORITY[b.status] ?? 9));
    // 줄을 고르는 것은 같은 화면 안의 일이라 주소가 바뀌어도 스크롤을 맨 위로 올리지 않는다
    const select = (next: string | null) =>
        setSearchParams(next ? { eventId: next } : {}, { preventScrollReset: true });

    return (
        <div className="flex flex-col gap-6 pb-10 md:pr-10">
            {/*
             * 단계 탭 — 개수와 요약을 함께 보이고, 누르면 그 단계만 거른다. 발표 대기가 가장 먼저.
             * 따로 떨어진 카드에 얇은 테두리만 바뀌면 누르는 곳인지 몰라, 한 판에 이어 붙인 탭으로 두고
             * 고른 칸은 먹색으로 통째로 채운다 (바닥 줄만 칠하면 흔한 템플릿처럼 보였다)
             */}
            <div
                role="radiogroup"
                aria-label="추첨 단계"
                className="bg-border-default border-border-default grid grid-cols-2 gap-px overflow-hidden rounded-2xl border lg:grid-cols-5"
            >
                <StageTile
                    label="전체"
                    count={isPending ? null : all.length}
                    selected={stage === 'all'}
                    onClick={() => setStage('all')}
                />
                {STAGE_ORDER.map((status) => (
                    <StageTile
                        key={status}
                        label={ADMIN_STATUS_META[status].label}
                        count={isPending ? null : countOf(status)}
                        note={
                            status === 'DRAW_CONFIRMED' && !isPending
                                ? longestWait(inStage(status), now)
                                : null
                        }
                        urgent={status === 'DRAW_CONFIRMED' && countOf(status) > 0}
                        selected={stage === status}
                        onClick={() => setStage(status)}
                    />
                ))}
            </div>

            <FilterPanel
                search={
                    <TextFilter
                        value={keywordInput}
                        onChange={setKeywordInput}
                        placeholder="이벤트 이름으로 검색"
                        label="추첨 이벤트 검색"
                        className="w-full"
                    />
                }
                onSubmit={() => setKeyword(keywordInput.trim())}
                onReset={resetFilters}
                activeCount={
                    [keyword, kind !== 'all', stage !== 'all', createdFrom || createdTo].filter(
                        Boolean,
                    ).length
                }
            >
                <FilterRow
                    label="종류"
                    value={chipValue(KIND_OPTIONS, kind)}
                    onClear={() => setKind('all')}
                >
                    <FilterChips
                        value={kind}
                        onChange={setKind}
                        options={KIND_OPTIONS}
                        label="종류"
                    />
                </FilterRow>
                <FilterRow
                    label="등록일"
                    value={rangeValue(createdFrom, createdTo)}
                    onClear={() => {
                        setCreatedFrom('');
                        setCreatedTo('');
                    }}
                >
                    <DateRangeFilter
                        name="등록일"
                        from={createdFrom}
                        to={createdTo}
                        onFromChange={setCreatedFrom}
                        onToChange={setCreatedTo}
                        error={createdRangeError ? '시작일이 종료일보다 늦습니다.' : null}
                    />
                </FilterRow>
            </FilterPanel>

            {isError && (
                <p role="alert" className="text-semantic-error-strong text-body-sm">
                    이벤트 목록을 불러오지 못했습니다.
                </p>
            )}

            {/* 줄을 고르면 오른쪽에 그 이벤트의 추첨 관리가 열린다 — 이벤트 관리와 같은 2열 */}
            <div
                className={cn(
                    'flex flex-col gap-6 xl:grid xl:items-start',
                    // 칸 너비를 애니메이션하면 표가 매 프레임 다시 줄을 맞추며 덜컥거렸다 — 너비는 한 번에 바꾸고
                    // 오른쪽 패널만 옅게 밀려 들어오게 한다
                    eventId
                        ? 'xl:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] xl:gap-x-6'
                        : 'xl:grid-cols-1',
                )}
            >
                <div className="flex min-w-0 flex-col gap-3">
                    {isPending && (
                        <LoadingBlock>
                            <CardSkeleton rows={3} />
                        </LoadingBlock>
                    )}
                    {!isPending && !isError && !createdRangeError && events.length === 0 && (
                        <p className="text-fg-secondary text-body-sm py-6">
                            {filtered
                                ? '조건에 맞는 이벤트가 없습니다. 조건을 바꿔 보세요.'
                                : '추첨을 관리할 이벤트가 없습니다. 이벤트가 마감되면 이곳에서 관리할 수 있습니다.'}
                        </p>
                    )}
                    {events.length > 0 && (
                        <DrawEventPicker
                            events={events}
                            selectedId={eventId || undefined}
                            compact={eventId !== ''}
                            onSelect={(next) => select(next === eventId ? null : next)}
                        />
                    )}
                    {truncated && (
                        <p className="text-caption text-fg-tertiary">
                            단계마다 최근 {EVENT_PICKER_SIZE}건까지 보여요. 더 찾으려면
                            검색어·종류·등록일로 좁혀 보세요.
                        </p>
                    )}
                </div>
                {eventId && (
                    // 이벤트 관리와 같은 인스펙터 — 화면 높이에 붙어 따라오고, 세로선 하나로 목록과 나눈다
                    <aside
                        ref={detailRef}
                        aria-label="추첨 관리 상세"
                        className="motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-right-2 xl:border-border-default min-w-0 scroll-mt-4 motion-safe:duration-200 xl:sticky xl:top-4 xl:h-[calc(100dvh-2rem)] xl:overflow-y-auto xl:border-l xl:pl-6"
                    >
                        <DrawEventPanel
                            key={eventId}
                            eventId={eventId}
                            onClose={() => select(null)}
                        />
                    </aside>
                )}
            </div>
        </div>
    );
}

/**
 * 단계 칸 — 위에 단계 이름, 아래에 건수(크게). 발표 대기만 오른쪽 끝에 대기 기간(작게)을 바닥선에 맞춰 붙인다.
 * 발표 대기가 남아 있으면 점과 브랜드색 건수로 먼저 눈에 걸리게 한다
 */
function StageTile({
    label,
    count,
    note = null,
    selected,
    urgent = false,
    onClick,
}: {
    label: string;
    count: number | null;
    note?: string | null;
    selected: boolean;
    urgent?: boolean;
    onClick: () => void;
}) {
    const sub = selected ? 'text-fg-inverse/70' : 'text-fg-tertiary';
    return (
        <button
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={onClick}
            className={cn(
                'focus-visible:ring-border-focus flex cursor-pointer flex-col gap-3 px-5 py-4 text-left transition-colors focus-visible:ring-2 focus-visible:outline-none focus-visible:ring-inset',
                selected ? 'bg-surface-inverse' : 'bg-surface-page hover:bg-surface-sunken',
            )}
        >
            <span
                className={cn(
                    'flex items-center gap-1.5 text-sm',
                    selected ? 'text-fg-inverse font-semibold' : 'text-fg-secondary font-medium',
                )}
            >
                {urgent && <span aria-hidden className="bg-brand-primary size-1.5 rounded-full" />}
                {label}
            </span>
            <span className="flex w-full items-baseline justify-between gap-2">
                <span
                    className={cn(
                        'text-[1.75rem] leading-8 font-bold tracking-tight tabular-nums',
                        selected ? 'text-fg-inverse' : urgent ? 'text-fg-brand' : 'text-fg-primary',
                    )}
                >
                    {count ?? '—'}
                    <span className={cn('ml-0.5 text-sm font-medium', sub)}>건</span>
                </span>
                {note && (
                    <span className={cn('text-caption whitespace-nowrap tabular-nums', sub)}>
                        {note}
                    </span>
                )}
            </span>
        </button>
    );
}
