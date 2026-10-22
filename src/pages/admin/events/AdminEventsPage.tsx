import { useState } from 'react';
import { Outlet, useMatch, useNavigate, useSearchParams } from 'react-router-dom';

import type { AdminEventStatus, EventType } from '@entities/event';

import {
    ADMIN_STATUS_META,
    AdminEventTable,
    EVENT_TYPE_LABEL,
    useAdminEvents,
} from '@entities/event';
import { isDateRangeOrdered } from '@shared/model/filterConstants';
import { Button } from '@shared/ui/button';
import { DateRangeFilter, TextFilter } from '@shared/ui/filter-fields';
import { Pagination } from '@shared/ui/pagination';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@shared/ui/select';
import { LoadingBlock, TableSkeleton } from '@shared/ui/skeleton';
import { cn } from '@shared/utils/cn';
import { kstInputToUtcIso } from '@shared/utils/date';
import { formatNumber } from '@shared/utils/format';

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
    { value: 'all', label: '이벤트 상태' },
    ...Object.entries(ADMIN_STATUS_META).map(([value, meta]) => ({
        value: value as AdminEventStatus,
        label: meta.label,
    })),
];

const TYPE_OPTIONS: { value: 'all' | EventType; label: string }[] = [
    { value: 'all', label: '응모권 유형' },
    ...(Object.entries(EVENT_TYPE_LABEL) as [EventType, string][]).map(([value, label]) => ({
        value,
        label,
    })),
];

// 종료일 입력(YYYY-MM-DD, KST)을 다음 날 00:00 UTC ISO로 변환해 [from, to) 구간의 상한을 만든다
const nextDay = (ymd: string) => {
    const d = new Date(`${ymd}T00:00:00+09:00`);
    d.setUTCDate(d.getUTCDate() + 1);
    return d.toISOString();
};

// 대시보드 카드가 /admin/events?status=…로 들어오는 값 — ADMIN_STATUS_META 키만 받아들인다
const asAdminStatus = (value: string | null): AdminEventStatus | null =>
    value !== null && value in ADMIN_STATUS_META ? (value as AdminEventStatus) : null;

export function AdminEventsPage() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const statusParam = asAdminStatus(searchParams.get('status'));
    // 오른쪽 칸에 열린 상세 — /admin/events/:eventId 하위 라우트
    const selectedId = useMatch('/admin/events/:eventId')?.params.eventId;
    // 상세를 열고 닫아도 ?status= 같은 목록 조건은 그대로 둔다
    const openDetail = (eventId: string | null) => {
        const search = searchParams.toString();
        void navigate({
            pathname: eventId ? `/admin/events/${encodeURIComponent(eventId)}` : '/admin/events',
            search: search ? `?${search}` : '',
        });
    };
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState<number>(PAGE_SIZE_OPTIONS[0]);
    const [keywordInput, setKeywordInput] = useState('');
    // 검색어는 엔터·버튼으로 확정된 값만 쿼리에 넘긴다 — 입력마다 요청하지 않는다
    const [keyword, setKeyword] = useState('');
    const [fromInput, setFromInput] = useState('');
    const [toInput, setToInput] = useState('');
    // 기간도 Select와 달리 즉시 적용되지 않고 검색 버튼으로 함께 적용된다 (응모 시작 시각 기준 [from, to))
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
    const draftFrom = fromInput ? kstInputToUtcIso(`${fromInput}T00:00`) : '';
    const draftTo = toInput ? nextDay(toInput) : '';
    const hasPendingDraft =
        keywordInput.trim() !== keyword ||
        draftFrom !== from ||
        draftTo !== to ||
        createdFromInput !== createdFrom ||
        createdToInput !== createdTo;
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

    const { data, isPending, isError, isFetching, refetch } = useAdminEvents({
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

    const totalPages = data ? Math.max(1, Math.ceil(data.totalElements / data.size)) : 0;
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

    return (
        <div className="flex flex-col gap-6 pr-10 pb-10">
            {/* '이벤트 관리' 설명 기본안 — 이 화면이 하는 일을 한 줄로 말해 준다 */}
            <p className="text-body-sm text-fg-secondary">
                이벤트 일정과 경품을 설정하고 운영 상태를 관리합니다.
            </p>
            {/* 첫 줄은 검색어·기간 검색과 등록, 둘째 줄은 바로 걸리는 선택형 필터(상태·유형·정렬·가중치)를 한데 묶는다 */}
            <div className="flex flex-col gap-3">
                <div className="flex flex-wrap items-center gap-3">
                    <form
                        className="flex flex-wrap items-center gap-2"
                        onSubmit={(e) => {
                            e.preventDefault();
                            const rangeValid = isDateRangeOrdered(fromInput, toInput);
                            const createdRangeValid = isDateRangeOrdered(
                                createdFromInput,
                                createdToInput,
                            );
                            setRangeError(!rangeValid);
                            setCreatedRangeError(!createdRangeValid);
                            if (!rangeValid || !createdRangeValid) {
                                return;
                            }
                            setRangeError(false);
                            setKeyword(keywordInput.trim());
                            setFrom(draftFrom);
                            setTo(draftTo);
                            setCreatedFrom(createdFromInput);
                            setCreatedTo(createdToInput);
                            resetPage();
                        }}
                    >
                        <TextFilter
                            value={keywordInput}
                            onChange={setKeywordInput}
                            placeholder="이벤트 이름·설명 검색"
                            label="이벤트 검색"
                            className="w-64"
                        />
                        <DateRangeFilter
                            from={fromInput}
                            to={toInput}
                            onFromChange={setFromInput}
                            onToChange={setToInput}
                            basis="응모 시작일"
                            error={rangeError ? '시작일이 종료일보다 늦습니다.' : null}
                        />
                        <DateRangeFilter
                            from={createdFromInput}
                            to={createdToInput}
                            onFromChange={setCreatedFromInput}
                            onToChange={setCreatedToInput}
                            basis="등록일"
                            error={createdRangeError ? '시작일이 종료일보다 늦습니다.' : null}
                        />
                        <Button type="submit" variant="secondary">
                            검색
                        </Button>
                        <Button type="button" variant="ghost" onClick={resetFilters}>
                            초기화
                        </Button>
                    </form>
                    <Button className="ml-auto" onClick={() => void navigate('/admin/events/new')}>
                        새 이벤트 등록
                    </Button>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                    <Select
                        value={status}
                        onValueChange={(v) => {
                            setStatus(v as 'all' | AdminEventStatus);
                            resetPage();
                        }}
                    >
                        <SelectTrigger className="w-40" aria-label="상태 필터">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {STATUS_OPTIONS.map(({ value, label }) => (
                                <SelectItem key={value} value={value}>
                                    {label}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>

                    <Select
                        value={eventType}
                        onValueChange={(v) => {
                            setEventType(v as 'all' | EventType);
                            resetPage();
                        }}
                    >
                        <SelectTrigger className="w-36" aria-label="유형 필터">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {TYPE_OPTIONS.map(({ value, label }) => (
                                <SelectItem key={value} value={value}>
                                    {label}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>

                    <Select
                        value={sort}
                        onValueChange={(value) => {
                            setSort(value);
                            resetPage();
                        }}
                    >
                        <SelectTrigger className="w-40" aria-label="이벤트 정렬">
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
                        value={weighting}
                        onValueChange={(value) => {
                            setWeighting(value);
                            resetPage();
                        }}
                    >
                        <SelectTrigger className="w-40" aria-label="가중치 필터">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">가중치 전체</SelectItem>
                            <SelectItem value="true">가중치 적용</SelectItem>
                            <SelectItem value="false">가중치 미적용</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>

            {hasPendingDraft && (
                <p className="text-fg-tertiary text-caption -mt-4">
                    변경한 조건은 검색을 눌러야 적용됩니다.
                </p>
            )}

            {/* 줄을 고르면 1단 → 2단 — 왼쪽은 줄인 목록, 오른쪽은 상세 */}
            <div
                className={cn(
                    'flex flex-col gap-6',
                    selectedId &&
                        'lg:grid lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] lg:items-start lg:gap-4',
                )}
            >
                <div className="flex min-w-0 flex-col gap-6">
                    {isPending && (
                        <LoadingBlock>
                            <TableSkeleton />
                        </LoadingBlock>
                    )}
                    {isError && (
                        <div className="flex items-center gap-3" role="alert">
                            <p className="text-semantic-error-strong text-body-sm">
                                이벤트 목록을 불러오지 못했습니다.
                            </p>
                            <Button size="sm" variant="secondary" onClick={() => void refetch()}>
                                다시 시도
                            </Button>
                        </div>
                    )}
                    {!isPending && !isError && data && data.items.length === 0 && (
                        <div className="flex flex-col gap-2 py-6">
                            <p className="text-fg-secondary text-body-sm">
                                해당하는 이벤트가 없습니다.
                            </p>
                            {hasAppliedFilters && (
                                <Button
                                    size="sm"
                                    variant="ghost"
                                    className="self-start"
                                    onClick={resetFilters}
                                >
                                    검색 조건 초기화
                                </Button>
                            )}
                        </div>
                    )}
                    {!isPending && !isError && isFetching && (
                        <p role="status" className="text-fg-tertiary text-caption -mt-4">
                            목록을 새로 확인하는 중…
                        </p>
                    )}
                    {data && data.items.length > 0 && (
                        <>
                            {/* 총 건수와 볼 개수는 표 위에 — 아래에 두면 목록을 다 내려야 몇 건인지 보였다 */}
                            <div className="-mb-3 flex items-center gap-3">
                                <span className="text-body-sm-bold text-fg-primary tabular-nums">
                                    총 {formatNumber(data.totalElements)}건
                                </span>
                                <Select
                                    value={String(pageSize)}
                                    onValueChange={(value) => {
                                        setPageSize(Number(value));
                                        resetPage();
                                    }}
                                >
                                    <SelectTrigger
                                        className="h-9 w-28"
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
                            <AdminEventTable
                                events={data.items}
                                compact={selectedId != null}
                                selectedId={selectedId}
                                onRowClick={(event) =>
                                    // 열린 줄을 다시 누르면 닫는다
                                    openDetail(event.id === selectedId ? null : event.id)
                                }
                            />
                            <Pagination
                                page={page}
                                totalPages={totalPages}
                                onPageChange={setPage}
                                jump
                                className="self-end"
                            />
                        </>
                    )}
                </div>
                {selectedId && (
                    <aside
                        aria-label="이벤트 상세"
                        className="min-w-0 lg:sticky lg:top-4 lg:max-h-[calc(100dvh-6rem)] lg:overflow-y-auto"
                    >
                        <Outlet />
                    </aside>
                )}
            </div>
        </div>
    );
}
