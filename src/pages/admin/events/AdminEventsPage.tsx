import { useState } from 'react';
import { Outlet, useMatch, useNavigate, useSearchParams } from 'react-router-dom';

import type { AdminEventStatus, EventType } from '@entities/event';

import { ADMIN_STATUS_META, AdminEventTable, useAdminEvents } from '@entities/event';
import { useRevealWhenStacked } from '@shared/hooks/useRevealWhenStacked';
import { isDateRangeOrdered } from '@shared/model/filterConstants';
import { Button } from '@shared/ui/button';
import { DateRangeFilter, TextFilter } from '@shared/ui/filter-fields';
import {
    chipValue,
    FilterChips,
    FilterPanel,
    FilterRow,
    rangeValue,
} from '@shared/ui/filter-panel';
import { PagedResult } from '@shared/ui/paged-result';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@shared/ui/select';
import { cn } from '@shared/utils/cn';

const RANGE_MSG = '시작일이 종료일보다 늦습니다.';

// 한 화면에 보는 줄 수 — 수천 건을 넘겨 보려면 30·100개씩 고를 수 있어야 한다 (AE01 size 최대 100)
const PAGE_SIZE_OPTIONS = [30, 100] as const;
const SORT_OPTIONS = [
    ['createdAt,desc', '등록일 최신'],
    ['createdAt,asc', '등록일 오래된'],
    ['startsAt,asc', '시작일 빠른'],
    ['startsAt,desc', '시작일 늦은'],
    ['endsAt,asc', '마감일 빠른'],
    ['endsAt,desc', '마감일 늦은'],
    ['title,asc', '제목 오름차순'],
    ['title,desc', '제목 내림차순'],
] as const;

const STATUS_OPTIONS: { value: 'all' | AdminEventStatus; label: string }[] = [
    { value: 'all', label: '전체' },
    ...Object.entries(ADMIN_STATUS_META).map(([value, meta]) => ({
        value: value as AdminEventStatus,
        label: meta.label,
    })),
];

// 계약 값(TICKET/NO_TICKET) 대신 서비스 이름으로 — 등록 화면의 종류 선택과 같은 말을 쓴다
const TYPE_OPTIONS: { value: 'all' | EventType; label: string }[] = [
    { value: 'all', label: '전체' },
    { value: 'TICKET', label: '겟또타임' },
    { value: 'NO_TICKET', label: '일반 이벤트' },
];

const WEIGHTING_OPTIONS = [
    { value: 'all', label: '전체' },
    { value: 'true', label: '적용' },
    { value: 'false', label: '미적용' },
];

// 대시보드 카드가 /admin/events?status=…로 들어오는 값 — ADMIN_STATUS_META 키만 받아들인다
const asAdminStatus = (value: string | null): AdminEventStatus | null =>
    value !== null && value in ADMIN_STATUS_META ? (value as AdminEventStatus) : null;

export function AdminEventsPage() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const statusParam = asAdminStatus(searchParams.get('status'));
    // 오른쪽 칸에 열린 상세 — /admin/events/:eventId 하위 라우트
    const selectedId = useMatch('/admin/events/:eventId')?.params.eventId;
    const detailRef = useRevealWhenStacked<HTMLElement>(selectedId, '(min-width: 1024px)');
    // 상세를 열고 닫아도 ?status= 같은 목록 조건은 그대로 둔다. 같은 화면 안의 일이라 스크롤도 맨 위로 올리지 않는다
    const openDetail = (eventId: string | null) => {
        const search = searchParams.toString();
        void navigate(
            {
                pathname: eventId
                    ? `/admin/events/${encodeURIComponent(eventId)}`
                    : '/admin/events',
                search: search ? `?${search}` : '',
            },
            { preventScrollReset: true },
        );
    };
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState<number>(PAGE_SIZE_OPTIONS[0]);
    const [keywordInput, setKeywordInput] = useState('');
    // 검색어는 엔터·버튼으로 확정된 값만 쿼리에 넘긴다 — 입력마다 요청하지 않는다
    const [keyword, setKeyword] = useState('');
    const [fromInput, setFromInput] = useState('');
    const [toInput, setToInput] = useState('');
    // 모집 기간은 검색 버튼으로 함께 적용된다 — AE01 from/to는 KST 날짜(YYYY-MM-DD) 그대로, 양 끝 포함이다 (05-api/event.md)
    const [from, setFrom] = useState('');
    const [to, setTo] = useState('');
    const [status, setStatus] = useState<'all' | AdminEventStatus>(statusParam ?? 'all');
    const [eventType, setEventType] = useState<'all' | EventType>('all');
    const [rangeError, setRangeError] = useState(false);
    const [sort, setSort] = useState('createdAt,desc');
    const [weighting, setWeighting] = useState('all');
    const [createdFromInput, setCreatedFromInput] = useState('');
    const [createdToInput, setCreatedToInput] = useState('');
    const [createdFrom, setCreatedFrom] = useState('');
    const [createdTo, setCreatedTo] = useState('');
    const [createdRangeError, setCreatedRangeError] = useState(false);

    // 같은 페이지에 머문 채 URL의 status가 바뀌면(대시보드 카드 재진입 등) 필터에 반영한다 — 렌더 중 비교 패턴
    const [appliedStatusParam, setAppliedStatusParam] = useState(statusParam);
    if (statusParam !== appliedStatusParam) {
        setAppliedStatusParam(statusParam);
        setStatus(statusParam ?? 'all');
        setPage(1);
    }

    // 검색 버튼으로 확정할 값을 미리 계산해 입력값과 적용값의 차이(미적용 변경)를 잡는다
    const hasAppliedFilters =
        keyword !== '' ||
        from !== '' ||
        to !== '' ||
        status !== 'all' ||
        eventType !== 'all' ||
        sort !== 'createdAt,desc' ||
        weighting !== 'all' ||
        createdFrom !== '' ||
        createdTo !== '';

    const { data, isPending, isError, isFetching, dataUpdatedAt, refetch } = useAdminEvents({
        page,
        size: pageSize,
        keyword: keyword || undefined,
        status: status === 'all' ? undefined : status,
        eventType: eventType === 'all' ? undefined : eventType,
        from: from || undefined,
        to: to || undefined,
        sort,
        weightingEnabled: weighting === 'all' ? undefined : weighting === 'true',
        createdFrom: createdFrom || undefined,
        createdTo: createdTo || undefined,
    });

    const resetPage = () => setPage(1);
    const resetFilters = () => {
        setKeywordInput('');
        setKeyword('');
        setFromInput('');
        setToInput('');
        setFrom('');
        setTo('');
        setStatus('all');
        setEventType('all');
        setSort('createdAt,desc');
        setWeighting('all');
        setCreatedFromInput('');
        setCreatedToInput('');
        setCreatedFrom('');
        setCreatedTo('');
        setCreatedRangeError(false);
        setRangeError(false);
        setPage(1);
        if (statusParam) void navigate('/admin/events', { replace: true });
    };

    const activeCount = [
        keyword,
        status !== 'all',
        eventType !== 'all',
        weighting !== 'all',
        from || to,
        createdFrom || createdTo,
    ].filter(Boolean).length;

    return (
        <div className="flex flex-col gap-6 pr-10 pb-10">
            <FilterPanel
                // 범위 오류도 줄 아래에 띄운다 — 알약 창이 닫혀 있으면 창 안의 오류만으로는 왜 검색이 안 되는지 몰랐다
                error={rangeError || createdRangeError ? RANGE_MSG : null}
                actions={
                    <Button onClick={() => void navigate('/admin/events/new')}>
                        새 이벤트 등록
                    </Button>
                }
                search={
                    <TextFilter
                        value={keywordInput}
                        onChange={setKeywordInput}
                        placeholder="이벤트 이름·설명으로 검색"
                        label="이벤트 검색"
                        className="w-full"
                    />
                }
                onSubmit={() => {
                    const rangeValid = isDateRangeOrdered(fromInput, toInput);
                    const createdRangeValid = isDateRangeOrdered(createdFromInput, createdToInput);
                    setRangeError(!rangeValid);
                    setCreatedRangeError(!createdRangeValid);
                    if (!rangeValid || !createdRangeValid) return false;
                    setKeyword(keywordInput.trim());
                    setFrom(fromInput);
                    setTo(toInput);
                    setCreatedFrom(createdFromInput);
                    setCreatedTo(createdToInput);
                    resetPage();
                }}
                onReset={resetFilters}
                activeCount={activeCount}
            >
                <FilterRow
                    label="상태"
                    value={chipValue(STATUS_OPTIONS, status)}
                    onClear={() => {
                        setStatus('all');
                        resetPage();
                    }}
                >
                    <FilterChips
                        value={status}
                        onChange={(value) => {
                            setStatus(value);
                            resetPage();
                        }}
                        options={STATUS_OPTIONS}
                        label="이벤트 상태"
                    />
                </FilterRow>
                <FilterRow
                    label="종류"
                    value={chipValue(TYPE_OPTIONS, eventType)}
                    onClear={() => {
                        setEventType('all');
                        resetPage();
                    }}
                >
                    <FilterChips
                        value={eventType}
                        onChange={(value) => {
                            setEventType(value);
                            resetPage();
                        }}
                        options={TYPE_OPTIONS}
                        label="이벤트 종류"
                    />
                </FilterRow>
                <FilterRow
                    label="모집 기간"
                    apply
                    value={rangeValue(from, to)}
                    onClear={() => {
                        setFromInput('');
                        setToInput('');
                        setFrom('');
                        setTo('');
                        resetPage();
                    }}
                >
                    <DateRangeFilter
                        name="모집 기간"
                        from={fromInput}
                        to={toInput}
                        onFromChange={setFromInput}
                        onToChange={setToInput}
                        error={rangeError ? RANGE_MSG : null}
                    />
                    {/* AE01 from/to는 모집 기간이 이 범위와 겹치는 이벤트를 찾는다 — 시작일 범위가 아니다 */}
                    <span className="text-caption text-fg-tertiary">
                        이 기간에 한 번이라도 모집 중인 이벤트
                    </span>
                </FilterRow>
                <FilterRow
                    label="등록일"
                    apply
                    value={rangeValue(createdFrom, createdTo)}
                    onClear={() => {
                        setCreatedFromInput('');
                        setCreatedToInput('');
                        setCreatedFrom('');
                        setCreatedTo('');
                        resetPage();
                    }}
                >
                    <DateRangeFilter
                        name="등록일"
                        from={createdFromInput}
                        to={createdToInput}
                        onFromChange={setCreatedFromInput}
                        onToChange={setCreatedToInput}
                        error={createdRangeError ? RANGE_MSG : null}
                    />
                </FilterRow>
                <FilterRow
                    label="가중치"
                    value={chipValue(WEIGHTING_OPTIONS, weighting)}
                    onClear={() => {
                        setWeighting('all');
                        resetPage();
                    }}
                >
                    <FilterChips
                        value={weighting}
                        onChange={(value) => {
                            setWeighting(value);
                            resetPage();
                        }}
                        options={WEIGHTING_OPTIONS}
                        label="가중치"
                    />
                </FilterRow>
            </FilterPanel>

            {/*
             * 줄을 고르면 1단 → 2단 — 왼쪽은 줄인 목록, 오른쪽은 상세(인스펙터).
             * 상세는 화면 높이에 붙어 스크롤을 따라오고 안쪽만 스크롤한다 — 아래쪽 줄을 눌러도 상세가 바로 옆에 있다.
             * 두 칸은 화면 높이의 세로선 하나로 나눈다 — 목록과 상세의 끝이 달라도 한쪽이 중간에 끊겨 보이지 않는다.
             * 칸 너비를 애니메이션하면 표가 매 프레임 줄을 다시 맞추며 덜컥거려, 너비는 한 번에 바꾸고 상세만 옅게 들인다
             */}
            <div
                className={cn(
                    'flex flex-col gap-6 lg:grid lg:items-start',
                    selectedId
                        ? 'lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] lg:gap-x-6'
                        : 'lg:grid-cols-1',
                )}
            >
                <div className="min-w-0">
                    <PagedResult
                        data={data}
                        isPending={isPending}
                        isError={isError}
                        isFetching={isFetching}
                        updatedAt={dataUpdatedAt}
                        page={page}
                        onPageChange={setPage}
                        emptyText="해당하는 이벤트가 없습니다."
                        errorText="이벤트 목록을 불러오지 못했습니다."
                        onRetry={() => void refetch()}
                        emptyAction={
                            hasAppliedFilters ? (
                                <Button
                                    size="sm"
                                    variant="ghost"
                                    className="self-start"
                                    onClick={resetFilters}
                                >
                                    검색 조건 초기화
                                </Button>
                            ) : undefined
                        }
                        toolbar={
                            <div className="flex items-center gap-2">
                                <Select
                                    value={sort}
                                    onValueChange={(value) => {
                                        setSort(value);
                                        resetPage();
                                    }}
                                >
                                    <SelectTrigger className="h-9 w-36" aria-label="이벤트 정렬">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {SORT_OPTIONS.map(([value, label]) => (
                                            <SelectItem key={value} value={value}>
                                                {label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <Select
                                    value={String(pageSize)}
                                    onValueChange={(value) => {
                                        setPageSize(Number(value));
                                        resetPage();
                                    }}
                                >
                                    <SelectTrigger
                                        className="h-9 w-32"
                                        aria-label="한 화면에 볼 개수"
                                    >
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {PAGE_SIZE_OPTIONS.map((size) => (
                                            <SelectItem key={size} value={String(size)}>
                                                {size}개씩 보기
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        }
                    >
                        {(items) => (
                            <AdminEventTable
                                events={items}
                                compact={selectedId != null}
                                selectedId={selectedId}
                                onRowClick={(event) =>
                                    // 열린 줄을 다시 누르면 닫는다
                                    openDetail(event.id === selectedId ? null : event.id)
                                }
                            />
                        )}
                    </PagedResult>
                </div>
                {selectedId && (
                    <aside
                        ref={detailRef}
                        aria-label="이벤트 상세"
                        className="motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-right-2 lg:border-border-default min-w-0 scroll-mt-4 motion-safe:duration-200 lg:sticky lg:top-4 lg:h-[calc(100dvh-2rem)] lg:overflow-y-auto lg:border-l lg:pl-6"
                    >
                        <Outlet />
                    </aside>
                )}
            </div>
        </div>
    );
}
