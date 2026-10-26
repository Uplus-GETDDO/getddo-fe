import { useRef, useState } from 'react';

import type { AdminMissionsParams } from '@entities/mission';

import { MISSION_STATUS_LABEL, useAdminMissions } from '@entities/mission';
import { MissionFormDialog } from '@features/manageMission';
import { getErrorMessage } from '@shared/api/errorMessage';
import { isDateRangeOrdered, orUndefined } from '@shared/model/filterConstants';
import { Badge } from '@shared/ui/badge';
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
import { StatusDot } from '@shared/ui/status-dot';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@shared/ui/table';
import { formatKstFullDot, kstDateStartUtcIso, kstNextDateStartUtcIso } from '@shared/utils/date';

import { MISSION_TYPE_LABEL } from './model/labels';
import { MissionDetailSheet } from './ui/MissionDetailSheet';

const RANGE_MSG = '시작일이 종료일보다 늦습니다.';

const TYPE_OPTIONS = [
    { value: 'all', label: '전체' },
    { value: 'SURVEY', label: '설문' },
    { value: 'QUIZ', label: '퀴즈' },
] as const;
const STATUS_OPTIONS = [
    { value: 'all', label: '전체' },
    ...Object.entries(MISSION_STATUS_LABEL).map(([value, label]) => ({ value, label })),
];

const EMPTY = { keyword: '', missionType: 'all', status: 'all', from: '', to: '' };
type Filters = typeof EMPTY;

const HEAD = 'text-fg-tertiary h-11 px-4 text-xs font-semibold whitespace-nowrap';
const CELL = 'px-4 py-3 align-middle';

// AM01 — 미션 목록. 다른 관리자 목록과 같은 필터 알약·표·옆 칸 상세
export function AdminMissionsPage() {
    const [page, setPage] = useState(1);
    const [draft, setDraft] = useState<Filters>(EMPTY);
    const [applied, setApplied] = useState<Filters>(EMPTY);
    const [rangeError, setRangeError] = useState(false);
    const [selected, setSelected] = useState<string | null>(null);
    // 상세 칸은 열릴 때 포커스를 가져간다 — 닫힘 후 누른 제목으로 포커스를 돌려준다
    const detailTriggerRef = useRef<HTMLButtonElement | null>(null);
    const [formOpen, setFormOpen] = useState(false);

    const params: AdminMissionsParams = {
        page,
        keyword: applied.keyword || undefined,
        missionType: orUndefined(applied.missionType) as AdminMissionsParams['missionType'],
        status: orUndefined(applied.status) as AdminMissionsParams['status'],
        // AM01 from/to는 startsAt이 [from, to)인 미션 — 고른 날짜(KST) 양끝을 포함하도록 끝은 다음 날 0시로 보낸다
        from: applied.from ? kstDateStartUtcIso(applied.from) : undefined,
        to: applied.to ? kstNextDateStartUtcIso(applied.to) : undefined,
    };
    const query = useAdminMissions(params);

    const patch = (value: Partial<Filters>) => setDraft((d) => ({ ...d, ...value }));
    // 유형·상태는 고르는 즉시 걸고, 글자·날짜만 검색·적용으로 확정한다
    const applyNow = (value: Partial<Filters>) => {
        patch(value);
        setApplied((d) => ({ ...d, ...value }));
        setPage(1);
    };
    const resetFilters = () => {
        setDraft(EMPTY);
        setApplied(EMPTY);
        setRangeError(false);
        setPage(1);
    };
    const activeCount = [
        applied.keyword,
        applied.missionType !== 'all',
        applied.status !== 'all',
        applied.from || applied.to,
    ].filter(Boolean).length;

    const openDetail = (id: string, trigger: HTMLButtonElement | null) => {
        detailTriggerRef.current = trigger;
        setSelected(id);
    };

    return (
        <div className="flex flex-col gap-6 pr-10 pb-10">
            <FilterPanel
                // 범위 오류도 줄 아래에 띄운다 — 알약 창이 닫혀 있으면 창 안의 오류만으로는 왜 검색이 안 되는지 몰랐다
                error={rangeError ? RANGE_MSG : null}
                actions={<Button onClick={() => setFormOpen(true)}>미션 등록</Button>}
                search={
                    <TextFilter
                        value={draft.keyword}
                        onChange={(keyword) => patch({ keyword })}
                        placeholder="미션 제목으로 검색"
                        label="미션 검색"
                        className="w-full"
                    />
                }
                onSubmit={() => {
                    if (!isDateRangeOrdered(draft.from, draft.to)) {
                        setRangeError(true);
                        return false;
                    }
                    setRangeError(false);
                    setApplied({ ...draft, keyword: draft.keyword.trim() });
                    setPage(1);
                }}
                onReset={resetFilters}
                activeCount={activeCount}
            >
                <FilterRow
                    label="유형"
                    value={chipValue(TYPE_OPTIONS, applied.missionType)}
                    onClear={() => applyNow({ missionType: 'all' })}
                >
                    <FilterChips
                        value={draft.missionType}
                        onChange={(missionType) => applyNow({ missionType })}
                        options={TYPE_OPTIONS}
                        label="미션 유형"
                    />
                </FilterRow>
                <FilterRow
                    label="상태"
                    value={chipValue(STATUS_OPTIONS, applied.status)}
                    onClear={() => applyNow({ status: 'all' })}
                >
                    <FilterChips
                        value={draft.status}
                        onChange={(status) => applyNow({ status })}
                        options={STATUS_OPTIONS}
                        label="미션 상태"
                    />
                </FilterRow>
                <FilterRow
                    label="시작일"
                    apply
                    value={rangeValue(applied.from, applied.to)}
                    onClear={() => applyNow({ from: '', to: '' })}
                >
                    <DateRangeFilter
                        name="시작일"
                        from={draft.from}
                        to={draft.to}
                        onFromChange={(from) => patch({ from })}
                        onToChange={(to) => patch({ to })}
                        error={rangeError ? RANGE_MSG : null}
                    />
                </FilterRow>
            </FilterPanel>

            {/* 줄을 고르면 오른쪽 칸에 상세 — 이벤트·추첨 관리와 같은 목록 + 상세 꼴 */}
            <ListDetailLayout
                open={selected !== null}
                detailKey={selected}
                label="미션 상세"
                detailSize="wide"
                list={
                    <PagedResult
                        data={query.data}
                        isPending={query.isPending}
                        isError={query.isError}
                        isFetching={query.isFetching}
                        updatedAt={query.dataUpdatedAt}
                        page={page}
                        onPageChange={(next) => {
                            setSelected(null);
                            setPage(next);
                        }}
                        emptyText={
                            activeCount > 0
                                ? '조건에 맞는 미션이 없습니다.'
                                : '등록된 미션이 없습니다.'
                        }
                        errorText={getErrorMessage(query.error, '미션을 조회하지 못했습니다.')}
                        onRetry={() => void query.refetch()}
                        emptyAction={
                            activeCount > 0 ? (
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
                        {(items) => (
                            <div className="bg-surface-page border-border-default overflow-hidden border-y">
                                <Table>
                                    <TableHeader>
                                        <TableRow className="hover:bg-transparent">
                                            <TableHead className={HEAD}>상태</TableHead>
                                            <TableHead className={HEAD}>미션</TableHead>
                                            <TableHead className={HEAD}>운영 기간</TableHead>
                                            <TableHead className={HEAD}>작성자</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {items.map((m) => (
                                            <TableRow
                                                key={m.id}
                                                aria-selected={m.id === selected}
                                                onClick={(e) =>
                                                    openDetail(
                                                        m.id,
                                                        e.currentTarget.querySelector('button'),
                                                    )
                                                }
                                                className="hover:bg-surface-sunken aria-selected:bg-surface-sunken cursor-pointer"
                                            >
                                                <TableCell className={CELL}>
                                                    <StatusDot
                                                        tone={
                                                            m.status === 'ACTIVE'
                                                                ? 'brand'
                                                                : 'muted'
                                                        }
                                                    >
                                                        {MISSION_STATUS_LABEL[m.status]}
                                                    </StatusDot>
                                                </TableCell>
                                                {/* 제목이 곧 상세 열기 — 유형은 제목 앞 작은 배지로 */}
                                                <TableCell className={`${CELL} max-w-96`}>
                                                    <span className="flex min-w-0 items-center gap-2">
                                                        <Badge variant="outline" size="sm">
                                                            {MISSION_TYPE_LABEL[m.missionType]}
                                                        </Badge>
                                                        <button
                                                            type="button"
                                                            aria-label={`${m.title} 상세`}
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                openDetail(m.id, e.currentTarget);
                                                            }}
                                                            className="text-body-sm-bold text-fg-primary focus-visible:ring-border-focus min-w-0 cursor-pointer truncate rounded-sm text-left hover:underline focus-visible:ring-2 focus-visible:outline-none"
                                                        >
                                                            {m.title}
                                                        </button>
                                                    </span>
                                                </TableCell>
                                                <TableCell
                                                    className={`${CELL} text-body-sm text-fg-secondary whitespace-nowrap tabular-nums`}
                                                >
                                                    {formatKstFullDot(m.startsAt, true)} ~{' '}
                                                    {formatKstFullDot(m.endsAt, true)}
                                                </TableCell>
                                                <TableCell
                                                    className={`${CELL} text-body-sm text-fg-secondary`}
                                                >
                                                    {m.createdByName ?? m.createdBy}
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        )}
                    </PagedResult>
                }
                detail={
                    <MissionDetailSheet
                        id={selected}
                        onClose={() => {
                            setSelected(null);
                            const trigger = detailTriggerRef.current;
                            requestAnimationFrame(() => trigger?.focus());
                        }}
                    />
                }
            />
            {formOpen && <MissionFormDialog open={formOpen} onOpenChange={setFormOpen} />}
        </div>
    );
}
