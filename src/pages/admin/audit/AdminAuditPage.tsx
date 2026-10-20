import { useState } from 'react';

import type { AuditLogSummary } from '@entities/audit';

import {
    AUDIT_ACTION_LABEL,
    AUDIT_TARGET_TYPE_LABEL,
    AuditLogDetailDrawer,
    AuditLogTable,
    useAuditLogs,
} from '@entities/audit';
import { kstInputToUtcIso } from '@shared/lib/date';
import { isDateRangeOrdered } from '@shared/lib/filterConstants';
import { Button } from '@shared/ui/button';
import { DateRangeFilter, TextFilter } from '@shared/ui/filter-fields';
import { PagedResult } from '@shared/ui/paged-result';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@shared/ui/select';

const PAGE_SIZE = 20;

const ACTION_OPTIONS = [
    { value: 'all', label: '전체 작업' },
    ...Object.entries(AUDIT_ACTION_LABEL).map(([value, label]) => ({ value, label })),
];

const TARGET_TYPE_OPTIONS = [
    { value: 'all', label: '전체 대상' },
    ...Object.entries(AUDIT_TARGET_TYPE_LABEL).map(([value, label]) => ({ value, label })),
];

// 종료일 입력(YYYY-MM-DD, KST)을 다음 날 00:00 UTC ISO로 변환해 [from, to) 구간의 상한을 만든다
const nextDay = (ymd: string) => {
    const d = new Date(`${ymd}T00:00:00+09:00`);
    d.setUTCDate(d.getUTCDate() + 1);
    return d.toISOString();
};

export function AdminAuditPage() {
    const [page, setPage] = useState(1);
    const [actorIdInput, setActorIdInput] = useState('');
    // 검색어는 검색 버튼으로 확정된 값만 쿼리에 넘긴다 — 입력마다 요청하지 않는다
    const [actorId, setActorId] = useState('');
    const [fromInput, setFromInput] = useState('');
    const [toInput, setToInput] = useState('');
    // 기간도 Select와 달리 즉시 적용되지 않고 검색 버튼으로 함께 적용된다 ([from, to), 처리 시각 기준)
    const [from, setFrom] = useState('');
    const [to, setTo] = useState('');
    const [action, setAction] = useState('all');
    const [targetType, setTargetType] = useState('all');
    const [rangeError, setRangeError] = useState(false);
    const [selected, setSelected] = useState<AuditLogSummary | null>(null);

    // 검색 버튼으로 확정할 값을 미리 계산해 입력값과 적용값의 차이(미적용 변경)를 잡는다
    const draftFrom = fromInput ? kstInputToUtcIso(`${fromInput}T00:00`) : '';
    const draftTo = toInput ? nextDay(toInput) : '';
    const hasPendingDraft = actorIdInput.trim() !== actorId || draftFrom !== from || draftTo !== to;
    const hasAppliedFilters =
        actorId !== '' || from !== '' || to !== '' || action !== 'all' || targetType !== 'all';

    const { data, isPending, isError, isFetching, dataUpdatedAt, refetch } = useAuditLogs({
        page,
        size: PAGE_SIZE,
        actorId: actorId || undefined,
        action: action === 'all' ? undefined : action,
        targetType: targetType === 'all' ? undefined : targetType,
        from: from || undefined,
        to: to || undefined,
    });
    const resetPage = () => setPage(1);
    const resetFilters = () => {
        setActorIdInput('');
        setActorId('');
        setFromInput('');
        setToInput('');
        setFrom('');
        setTo('');
        setAction('all');
        setTargetType('all');
        setRangeError(false);
        setPage(1);
    };

    return (
        <div className="flex flex-col gap-6 pr-10 pb-10">
            <div className="flex flex-wrap items-center gap-3">
                <form
                    className="flex flex-wrap items-center gap-2"
                    onSubmit={(e) => {
                        e.preventDefault();
                        if (!isDateRangeOrdered(fromInput, toInput)) {
                            setRangeError(true);
                            return;
                        }
                        setRangeError(false);
                        setActorId(actorIdInput.trim());
                        setFrom(draftFrom);
                        setTo(draftTo);
                        resetPage();
                    }}
                >
                    <TextFilter
                        value={actorIdInput}
                        onChange={setActorIdInput}
                        placeholder="처리자 ID 검색"
                        label="처리자 검색"
                        className="w-64"
                    />
                    <DateRangeFilter
                        from={fromInput}
                        to={toInput}
                        onFromChange={setFromInput}
                        onToChange={setToInput}
                        basis="처리일"
                        error={rangeError ? '시작일이 종료일보다 늦습니다.' : null}
                    />
                    <Button type="submit" variant="secondary">
                        검색
                    </Button>
                    <Button type="button" variant="ghost" onClick={resetFilters}>
                        초기화
                    </Button>
                </form>

                <Select
                    value={action}
                    onValueChange={(v) => {
                        setAction(v);
                        resetPage();
                    }}
                >
                    <SelectTrigger className="w-40" aria-label="작업 필터">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        {ACTION_OPTIONS.map(({ value, label }) => (
                            <SelectItem key={value} value={value}>
                                {label}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>

                <Select
                    value={targetType}
                    onValueChange={(v) => {
                        setTargetType(v);
                        resetPage();
                    }}
                >
                    <SelectTrigger className="w-36" aria-label="대상 유형 필터">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        {TARGET_TYPE_OPTIONS.map(({ value, label }) => (
                            <SelectItem key={value} value={value}>
                                {label}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            {hasPendingDraft && (
                <p className="text-fg-tertiary text-caption -mt-4">
                    변경한 조건은 검색을 눌러야 적용됩니다.
                </p>
            )}

            <PagedResult
                data={data}
                isPending={isPending}
                isError={isError}
                isFetching={isFetching}
                updatedAt={dataUpdatedAt}
                page={page}
                onPageChange={setPage}
                emptyText="해당하는 감사 로그가 없습니다."
                errorText="감사 로그를 불러오지 못했습니다."
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
                {(items) => <AuditLogTable logs={items} onRowClick={setSelected} />}
            </PagedResult>

            <AuditLogDetailDrawer
                summary={selected}
                open={selected !== null}
                onOpenChange={(open) => {
                    if (!open) setSelected(null);
                }}
            />
        </div>
    );
}
