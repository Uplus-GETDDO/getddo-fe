import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import type { AdminEventStatus, EventType } from '@entities/event';

import { ADMIN_STATUS_META, useAdminEventsByStatus } from '@entities/event';
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
import { PolicyPendingNotice } from './ui/PolicyPendingNotice';

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
// 단계 칸마다 지금 해야 할 일을 한 줄로 — '마감 이후 n개'처럼 숫자만 있으면 무엇을 하라는지 몰랐다
const STAGE_HINT: Record<string, string> = {
    DRAW_CONFIRMED: '결과를 확인하고 공개해 주세요',
    REDRAWING: '재추첨이 끝나면 명단을 갱신해요',
    CLOSED: '자동 추첨이 진행 중이에요',
    PUBLISHED: '당첨자 공개가 끝났어요',
};
const STAGE_ORDER: readonly AdminEventStatus[] = [
    'DRAW_CONFIRMED',
    'REDRAWING',
    'CLOSED',
    'PUBLISHED',
];

export function AdminDrawPage() {
    const [searchParams, setSearchParams] = useSearchParams();
    const eventId = searchParams.get('eventId') ?? '';
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
    const countOf = (status: AdminEventStatus) => all.filter((e) => e.status === status).length;
    const events = all
        .filter((e) => stage === 'all' || e.status === stage)
        .sort((a, b) => (DRAW_PRIORITY[a.status] ?? 9) - (DRAW_PRIORITY[b.status] ?? 9));
    const select = (next: string | null) => setSearchParams(next ? { eventId: next } : {});

    return (
        <div className="flex flex-col gap-6 pb-10 md:pr-10">
            {/*
             * 단계 탭 — 개수와 할 일을 함께 보이고, 누르면 그 단계만 거른다. 발표 대기가 가장 먼저.
             * 따로 떨어진 카드에 얇은 테두리만 바뀌면 누르는 곳인지 몰라, 한 판에 이어 붙인 탭으로 두고
             * 고른 칸은 바닥에 굵은 먹색 줄을 긋는다
             */}
            <div
                role="radiogroup"
                aria-label="추첨 단계"
                className="bg-border-default border-border-default grid grid-cols-2 gap-px overflow-hidden rounded-2xl border lg:grid-cols-5"
            >
                <StageTile
                    label="전체"
                    count={isPending ? null : all.length}
                    hint="마감 이후 모든 이벤트"
                    selected={stage === 'all'}
                    onClick={() => setStage('all')}
                />
                {STAGE_ORDER.map((status) => (
                    <StageTile
                        key={status}
                        label={ADMIN_STATUS_META[status].label}
                        count={isPending ? null : countOf(status)}
                        hint={STAGE_HINT[status] ?? ''}
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
                    'flex flex-col gap-6 xl:grid xl:items-start xl:transition-[grid-template-columns,column-gap] xl:duration-300 xl:ease-out',
                    eventId
                        ? 'xl:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] xl:gap-x-4'
                        : 'xl:grid-cols-[minmax(0,1fr)_minmax(0,0fr)] xl:gap-x-0',
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
                    <aside
                        aria-label="추첨 관리 상세"
                        className="motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-right-6 min-w-0 motion-safe:duration-300"
                    >
                        <DrawEventPanel
                            key={eventId}
                            eventId={eventId}
                            onClose={() => select(null)}
                        />
                    </aside>
                )}
            </div>

            {/* 계약 대기 안내 — 운영 화면의 첫 자리를 차지하지 않게 맨 아래에 접어 둔다 */}
            <PolicyPendingNotice />
        </div>
    );
}

/** 단계 칸 — 개수를 크게, 할 일을 작게. 발표 대기가 남아 있으면 브랜드 테두리로 먼저 눈에 걸리게 한다 */
function StageTile({
    label,
    count,
    hint,
    selected,
    urgent = false,
    onClick,
}: {
    label: string;
    count: number | null;
    hint: string;
    selected: boolean;
    urgent?: boolean;
    onClick: () => void;
}) {
    return (
        <button
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={onClick}
            className={cn(
                'focus-visible:ring-border-focus flex cursor-pointer flex-col items-start gap-1.5 px-5 py-4 text-left transition-colors focus-visible:ring-2 focus-visible:outline-none focus-visible:ring-inset',
                selected
                    ? 'bg-surface-canvas shadow-[inset_0_-3px_0_var(--color-fg-primary)]'
                    : 'bg-surface-page hover:bg-surface-canvas',
            )}
        >
            <span
                className={cn(
                    'flex items-center gap-1.5 text-sm',
                    selected ? 'text-fg-primary font-semibold' : 'text-fg-secondary font-medium',
                )}
            >
                {urgent && <span aria-hidden className="bg-brand-primary size-1.5 rounded-full" />}
                {label}
            </span>
            <span
                className={cn(
                    'text-[1.75rem] leading-9 font-bold tracking-tight tabular-nums',
                    urgent ? 'text-fg-brand' : 'text-fg-primary',
                )}
            >
                {count ?? '—'}
            </span>
            <span className="text-caption text-fg-tertiary">{hint}</span>
        </button>
    );
}
