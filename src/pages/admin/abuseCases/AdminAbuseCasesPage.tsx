import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { z } from 'zod';

import type { AbuseCase } from '@entities/abuseCase';

import { AbuseCaseDetailDrawer, AbuseCaseTable, useAbuseCases } from '@entities/abuseCase';
import { isDateRangeOrdered } from '@shared/model/filterConstants';
import { Button } from '@shared/ui/button';
import { DateRangeFilter, OptionFilter, TextFilter } from '@shared/ui/filter-fields';
import { Pagination } from '@shared/ui/pagination';
import { LoadingBlock, TableSkeleton } from '@shared/ui/skeleton';
import { kstDateStartUtcIso, kstNextDateStartUtcIso, parseYmd } from '@shared/utils/date';

const PAGE_SIZE = 20;

// spec AR01의 sourceType 값 — 이번 계약은 ENTRY(이벤트 응모 요청) 하나다
const SOURCE_TYPE_OPTIONS = [
    { value: 'all', label: '전체 구분' },
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
    const [sourceType, setSourceType] = useState('all');
    const [inputError, setInputError] = useState<string | null>(null);
    const [selected, setSelected] = useState<AbuseCase | null>(null);

    // 검색 버튼으로 확정할 값을 미리 계산해 입력값과 적용값의 차이(미적용 변경)를 잡는다
    const draftFrom = fromInput ? kstDateStartUtcIso(fromInput) : '';
    const draftTo = toInput ? kstNextDateStartUtcIso(toInput) : '';
    const hasPendingDraft =
        userIdInput.trim() !== userId ||
        eventIdInput.trim() !== eventId ||
        draftFrom !== from ||
        draftTo !== to;
    const hasAppliedFilters =
        userId !== '' || eventId !== '' || from !== '' || to !== '' || sourceType !== 'all';

    const { data, isPending, isError, isFetching, refetch } = useAbuseCases({
        page,
        size: PAGE_SIZE,
        userId: userId || undefined,
        eventId: eventId || undefined,
        sourceType: sourceType === 'all' ? undefined : sourceType,
        from: from || undefined,
        to: to || undefined,
    });

    const totalPages = data ? Math.max(1, Math.ceil(data.totalElements / data.size)) : 0;
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
        setSourceType('all');
        setInputError(null);
        setPage(1);
    };

    return (
        <div className="flex flex-col gap-6 pr-10 pb-10">
            {/* '어뷰징 관리' 설명 기본안 — 이 화면이 하는 일을 한 줄로 말해 준다 */}
            <p className="text-body-sm text-fg-secondary">
                이벤트 응모 요청의 자동 일시 차단 이력을 확인합니다.
            </p>
            <div className="flex flex-wrap items-center gap-3">
                <form
                    className="flex flex-wrap items-center gap-2"
                    onSubmit={(e) => {
                        e.preventDefault();
                        const trimmedUserId = userIdInput.trim();
                        const trimmedEventId = eventIdInput.trim();
                        // userId·eventId는 UUID라 형식이 틀린 값은 보내도 빈 결과만 돌아온다
                        if (
                            (trimmedUserId && !z.uuid().safeParse(trimmedUserId).success) ||
                            (trimmedEventId && !z.uuid().safeParse(trimmedEventId).success)
                        ) {
                            setInputError('사용자·이벤트 ID는 올바른 UUID 형식이어야 합니다.');
                            return;
                        }
                        if (!isDateRangeOrdered(fromInput, toInput)) {
                            setInputError(RANGE_ERROR);
                            return;
                        }
                        setInputError(null);
                        setUserId(trimmedUserId);
                        setEventId(trimmedEventId);
                        setFrom(draftFrom);
                        setTo(draftTo);
                        resetPage();
                    }}
                >
                    <TextFilter
                        value={userIdInput}
                        onChange={setUserIdInput}
                        placeholder="사용자 ID 검색"
                        label="사용자 검색"
                        className="w-64"
                    />
                    <TextFilter
                        value={eventIdInput}
                        onChange={setEventIdInput}
                        placeholder="이벤트 ID 검색"
                        label="이벤트 검색"
                        className="w-64"
                    />
                    <DateRangeFilter
                        from={fromInput}
                        to={toInput}
                        onFromChange={setFromInput}
                        onToChange={setToInput}
                        basis="차단 시작일"
                        error={inputError === RANGE_ERROR ? RANGE_ERROR : null}
                    />
                    <Button type="submit" variant="secondary">
                        검색
                    </Button>
                    <Button type="button" variant="ghost" onClick={resetFilters}>
                        초기화
                    </Button>
                    {inputError && inputError !== RANGE_ERROR && (
                        <p
                            role="alert"
                            className="text-semantic-error-strong text-caption basis-full"
                        >
                            {inputError}
                        </p>
                    )}
                </form>

                <OptionFilter
                    value={sourceType}
                    onChange={(v) => {
                        setSourceType(v);
                        resetPage();
                    }}
                    options={SOURCE_TYPE_OPTIONS}
                    label="구분 필터"
                />
            </div>

            {hasPendingDraft && (
                <p className="text-fg-tertiary text-caption -mt-4">
                    변경한 조건은 검색을 눌러야 적용됩니다.
                </p>
            )}

            {isPending && (
                <LoadingBlock>
                    <TableSkeleton />
                </LoadingBlock>
            )}
            {isError && (
                <div className="flex items-center gap-3" role="alert">
                    <p className="text-semantic-error-strong text-body-sm">
                        차단 내역을 불러오지 못했습니다.
                    </p>
                    <Button size="sm" variant="secondary" onClick={() => void refetch()}>
                        다시 시도
                    </Button>
                </div>
            )}
            {!isPending && !isError && data && data.items.length === 0 && (
                <div className="flex flex-col gap-2 py-6">
                    <p className="text-fg-secondary text-body-sm">해당하는 차단 내역이 없습니다.</p>
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
                <AbuseCaseTable cases={data.items} onRowClick={setSelected} />
            )}
            {data && data.totalElements > 0 && (
                <div className="flex items-center justify-between">
                    <span className="text-body-sm text-fg-secondary">
                        총 {data.totalElements}건
                    </span>
                    <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
                </div>
            )}

            <AbuseCaseDetailDrawer
                abuseCase={selected}
                open={selected !== null}
                onOpenChange={(open) => {
                    if (!open) setSelected(null);
                }}
            />
        </div>
    );
}
