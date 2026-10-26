import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { z } from 'zod';

import type { AbuseCase } from '@entities/abuseCase';

import { AbuseCaseDetailDrawer, AbuseCaseTable, useAbuseCases } from '@entities/abuseCase';
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
import { ListDetailLayout } from '@shared/ui/inspector';
import { PagedResult } from '@shared/ui/paged-result';
import { kstDateStartUtcIso, kstNextDateStartUtcIso, parseYmd } from '@shared/utils/date';

const PAGE_SIZE = 20;

// spec AR01의 sourceType 값 — 이번 계약은 ENTRY(이벤트 응모 요청) 하나다
const SOURCE_TYPE_OPTIONS = [
    { value: 'all', label: '전체' },
    { value: 'ENTRY', label: '이벤트 응모' },
];

const RANGE_ERROR = '시작일이 종료일보다 늦습니다.';

export function AdminAbuseCasesPage() {
    // 대시보드 '오늘 어뷰징 차단' 카드에서 들어오면(?date=YYYY-MM-DD) 그날로 걸러진 채 연다
    const [searchParams] = useSearchParams();
    const linkedDate = parseYmd(searchParams.get('date')) ?? '';
    const [page, setPage] = useState(1);
    const [userIdInput, setUserIdInput] = useState('');
    // 검색어는 검색 버튼으로 확정된 값만 쿼리에 넘긴다 — 입력마다 요청하지 않는다
    const [userId, setUserId] = useState('');
    const [eventIdInput, setEventIdInput] = useState('');
    const [eventId, setEventId] = useState('');
    const [fromInput, setFromInput] = useState(linkedDate);
    const [toInput, setToInput] = useState(linkedDate);
    // 기간도 Select와 달리 즉시 적용되지 않고 검색 버튼으로 함께 적용된다 ([from, to), blockedAt 기준)
    const [from, setFrom] = useState(linkedDate ? kstDateStartUtcIso(linkedDate) : '');
    const [to, setTo] = useState(linkedDate ? kstNextDateStartUtcIso(linkedDate) : '');
    // 알약 요약은 적용된 날짜(YYYY-MM-DD)로 — 입력칸 값으로 그리면 적용 전 값이 보이거나, 입력만 비워도 알약이 꺼졌다
    const [appliedRange, setAppliedRange] = useState({ from: linkedDate, to: linkedDate });
    const [sourceType, setSourceType] = useState('all');
    const [inputError, setInputError] = useState<string | null>(null);
    const [selected, setSelected] = useState<AbuseCase | null>(null);

    // 검색 버튼으로 확정할 값을 미리 계산해 입력값과 적용값의 차이(미적용 변경)를 잡는다
    const draftFrom = fromInput ? kstDateStartUtcIso(fromInput) : '';
    const draftTo = toInput ? kstNextDateStartUtcIso(toInput) : '';
    const hasAppliedFilters =
        userId !== '' || eventId !== '' || from !== '' || to !== '' || sourceType !== 'all';

    const { data, isPending, isError, isFetching, dataUpdatedAt, refetch } = useAbuseCases({
        page,
        size: PAGE_SIZE,
        userId: userId || undefined,
        eventId: eventId || undefined,
        sourceType: sourceType === 'all' ? undefined : sourceType,
        from: from || undefined,
        to: to || undefined,
    });

    const resetPage = () => setPage(1);
    const resetFilters = () => {
        setUserIdInput('');
        setUserId('');
        setEventIdInput('');
        setEventId('');
        setFromInput('');
        setToInput('');
        setFrom('');
        setTo('');
        setAppliedRange({ from: '', to: '' });
        setSourceType('all');
        setInputError(null);
        setPage(1);
    };

    return (
        <div className="flex flex-col gap-6 pr-10 pb-10">
            <p className="text-body-sm text-fg-secondary">
                응모를 너무 자주 시도해 자동으로 잠시 막힌 기록이에요.
            </p>
            <FilterPanel
                search={
                    <TextFilter
                        value={userIdInput}
                        onChange={setUserIdInput}
                        placeholder="사용자 ID로 검색"
                        label="사용자 검색"
                        className="w-full"
                    />
                }
                onSubmit={() => {
                    const trimmedUserId = userIdInput.trim();
                    const trimmedEventId = eventIdInput.trim();
                    // userId·eventId는 UUID라 형식이 틀린 값은 보내도 빈 결과만 돌아온다
                    if (
                        (trimmedUserId && !z.uuid().safeParse(trimmedUserId).success) ||
                        (trimmedEventId && !z.uuid().safeParse(trimmedEventId).success)
                    ) {
                        setInputError('사용자·이벤트 ID는 올바른 UUID 형식이어야 합니다.');
                        return false;
                    }
                    if (!isDateRangeOrdered(fromInput, toInput)) {
                        setInputError(RANGE_ERROR);
                        return false;
                    }
                    setInputError(null);
                    setUserId(trimmedUserId);
                    setEventId(trimmedEventId);
                    setFrom(draftFrom);
                    setTo(draftTo);
                    setAppliedRange({ from: fromInput, to: toInput });
                    resetPage();
                }}
                // 범위 오류도 줄 아래에 띄운다 — 알약 창이 닫혀 있으면 창 안의 오류만으로는 왜 검색이 안 되는지 몰랐다
                error={inputError}
                onReset={resetFilters}
                activeCount={
                    [userId, eventId, from || to, sourceType !== 'all'].filter(Boolean).length
                }
            >
                <FilterRow
                    label="차단일"
                    apply
                    value={rangeValue(appliedRange.from, appliedRange.to)}
                    onClear={() => {
                        setFromInput('');
                        setToInput('');
                        setFrom('');
                        setTo('');
                        setAppliedRange({ from: '', to: '' });
                        resetPage();
                    }}
                >
                    <DateRangeFilter
                        name="차단일"
                        from={fromInput}
                        to={toInput}
                        onFromChange={setFromInput}
                        onToChange={setToInput}
                        error={inputError === RANGE_ERROR ? RANGE_ERROR : null}
                    />
                </FilterRow>
                <FilterRow
                    label="관련 이벤트"
                    apply
                    value={eventId ? `${eventId.slice(0, 8)}…` : undefined}
                    onClear={() => {
                        setEventIdInput('');
                        setEventId('');
                        resetPage();
                    }}
                >
                    <TextFilter
                        value={eventIdInput}
                        onChange={setEventIdInput}
                        placeholder="이벤트 ID"
                        label="이벤트 검색"
                        className="w-80"
                    />
                </FilterRow>
                <FilterRow
                    label="구분"
                    value={chipValue(SOURCE_TYPE_OPTIONS, sourceType)}
                    onClear={() => {
                        setSourceType('all');
                        resetPage();
                    }}
                >
                    <FilterChips
                        value={sourceType}
                        onChange={(v) => {
                            setSourceType(v);
                            resetPage();
                        }}
                        options={SOURCE_TYPE_OPTIONS}
                        label="구분"
                    />
                </FilterRow>
            </FilterPanel>

            {/* 줄을 고르면 오른쪽 칸에 상세 — 이벤트·추첨 관리와 같은 목록 + 상세 꼴 */}
            <ListDetailLayout
                open={selected !== null}
                detailKey={selected?.id}
                label="차단 내역 상세"
                list={
                    <PagedResult
                        data={data}
                        isPending={isPending}
                        isError={isError}
                        isFetching={isFetching}
                        updatedAt={dataUpdatedAt}
                        page={page}
                        onPageChange={setPage}
                        emptyText="해당하는 차단 내역이 없습니다."
                        errorText="차단 내역을 불러오지 못했습니다."
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
                    >
                        {(items) => <AbuseCaseTable cases={items} onRowClick={setSelected} />}
                    </PagedResult>
                }
                detail={
                    <AbuseCaseDetailDrawer
                        abuseCase={selected}
                        open={selected !== null}
                        onOpenChange={(open) => {
                            if (!open) setSelected(null);
                        }}
                    />
                }
            />
        </div>
    );
}
