import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import type { AdminEventStatus, EventType } from '@entities/event';

import { ADMIN_STATUS_META, useAdminEvents } from '@entities/event';
import { DateRangeFilter, OptionFilter } from '@shared/ui/filter-fields';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@shared/ui/select';
import { CardSkeleton, LoadingBlock } from '@shared/ui/skeleton';

import { DrawEventPanel } from './ui/DrawEventPanel';
import { DrawEventPicker } from './ui/DrawEventPicker';
import { PolicyPendingNotice } from './ui/PolicyPendingNotice';

// 마감 이후 추첨 단계(자동 추첨 대기·진행, 확정, 발표, 재추첨)의 이벤트를 관리 대상으로 고른다.
// 마감(CLOSED)도 최초 추첨 실행이 생길 수 있어 포함한다 — 대시보드 '추첨 필요'와 같은 범위
const DRAW_STATUSES: ReadonlySet<AdminEventStatus> = new Set([
    'CLOSED',
    'DRAW_CONFIRMED',
    'PUBLISHED',
    'REDRAWING',
]);
// 손이 먼저 가야 하는 순서 — 재추첨 중 > 발표 대기 > 마감(추첨 진행) > 발표 완료
const DRAW_PRIORITY: Record<string, number> = {
    REDRAWING: 0,
    DRAW_CONFIRMED: 1,
    CLOSED: 2,
    PUBLISHED: 3,
};
// 이벤트 선택 목록은 한 번에 담는다 — 목업 규모(관리 이벤트 33건 내외)를 덮는 AE01 최대 크기
const EVENT_PICKER_SIZE = 100;

// 추첨 대상 거르기 — 이벤트·겟또타임은 운영 방식이 달라 먼저 나눈다 (겟또타임 = 응모권 사용 이벤트)
const KIND_OPTIONS: { value: 'all' | EventType; label: string }[] = [
    { value: 'all', label: '전체 유형' },
    { value: 'TICKET', label: '겟또타임' },
    { value: 'NO_TICKET', label: '이벤트' },
];
// 상세에서 가장 먼저 보는 값은 추첨 단계라 단계를 필터로 둔다 — 손이 먼저 가야 하는 순서대로
const STAGE_OPTIONS: { value: 'all' | AdminEventStatus; label: string }[] = [
    { value: 'all', label: '전체 단계' },
    ...(['REDRAWING', 'DRAW_CONFIRMED', 'CLOSED', 'PUBLISHED'] as const).map((value) => ({
        value,
        label: ADMIN_STATUS_META[value].label,
    })),
];

export function AdminDrawPage() {
    const [searchParams, setSearchParams] = useSearchParams();
    const eventId = searchParams.get('eventId') ?? '';
    const [kind, setKind] = useState<'all' | EventType>('all');
    const [stage, setStage] = useState<'all' | AdminEventStatus>('all');
    const [createdFrom, setCreatedFrom] = useState('');
    const [createdTo, setCreatedTo] = useState('');
    const createdRangeError = createdFrom !== '' && createdTo !== '' && createdFrom > createdTo;
    // 유형·등록일은 서버(AE01)가 거르고, 단계는 추첨 단계 네 개만 받아 이 화면에서 거른다 (AE01 상태 필터는 하나만 받는다)
    const { data, isPending, isError } = useAdminEvents({
        page: 1,
        size: EVENT_PICKER_SIZE,
        eventType: kind === 'all' ? undefined : kind,
        createdFrom: createdFrom && !createdRangeError ? createdFrom : undefined,
        createdTo: createdTo && !createdRangeError ? createdTo : undefined,
    });
    const filtered = kind !== 'all' || stage !== 'all' || createdFrom !== '' || createdTo !== '';

    const events = (data?.items ?? [])
        .filter((e) => DRAW_STATUSES.has(e.status) && (stage === 'all' || e.status === stage))
        .sort((a, b) => (DRAW_PRIORITY[a.status] ?? 9) - (DRAW_PRIORITY[b.status] ?? 9));
    // 상세 화면 등에서 URL로 들어온 이벤트는 목록 조건과 무관하게 열 수 있어야 한다
    const selectedInList = events.some((e) => e.id === eventId);

    return (
        <div className="flex flex-col gap-6 pb-10 md:pr-10">
            <div className="flex flex-wrap items-center gap-3">
                <label htmlFor="draw-event-select" className="text-body-bold text-fg-primary">
                    이벤트
                </label>
                <Select
                    value={eventId}
                    onValueChange={(next) => setSearchParams({ eventId: next })}
                    disabled={isPending || isError}
                >
                    <SelectTrigger id="draw-event-select" className="w-96 max-w-full">
                        <SelectValue placeholder="추첨을 관리할 이벤트를 선택하세요" />
                    </SelectTrigger>
                    <SelectContent>
                        {!selectedInList && eventId && (
                            <SelectItem value={eventId}>{eventId}</SelectItem>
                        )}
                        {events.map((e) => (
                            <SelectItem key={e.id} value={e.id}>
                                {e.title} · {ADMIN_STATUS_META[e.status].label}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            {/* 거르기 — 이벤트를 고르기 전 목록에만 걸린다. 고른 뒤에는 위 선택 상자로 바꾼다 */}
            {!eventId && (
                <div className="flex flex-wrap items-center gap-3">
                    <OptionFilter
                        value={kind}
                        onChange={(value) => setKind(value as 'all' | EventType)}
                        options={KIND_OPTIONS}
                        label="유형 필터"
                    />
                    <OptionFilter
                        value={stage}
                        onChange={(value) => setStage(value as 'all' | AdminEventStatus)}
                        options={STAGE_OPTIONS}
                        label="추첨 단계 필터"
                        className="w-40"
                    />
                    <DateRangeFilter
                        from={createdFrom}
                        to={createdTo}
                        onFromChange={setCreatedFrom}
                        onToChange={setCreatedTo}
                        basis="등록일"
                        error={createdRangeError ? '시작일이 종료일보다 늦습니다.' : null}
                    />
                </div>
            )}

            {isPending && (
                <LoadingBlock>
                    <CardSkeleton rows={3} />
                </LoadingBlock>
            )}
            {isError && (
                <p role="alert" className="text-semantic-error-strong text-body-sm">
                    이벤트 목록을 불러오지 못했습니다.
                </p>
            )}
            {!isPending && !isError && events.length === 0 && !eventId && (
                <p className="text-fg-secondary text-body-sm py-6">
                    {filtered
                        ? '조건에 맞는 이벤트가 없습니다. 필터를 바꿔 보세요.'
                        : '추첨을 관리할 이벤트가 없습니다. 이벤트가 마감되면 이곳에서 관리할 수 있습니다.'}
                </p>
            )}
            {!eventId && events.length > 0 && (
                <DrawEventPicker
                    events={events}
                    onSelect={(next) => setSearchParams({ eventId: next })}
                />
            )}

            {eventId && <DrawEventPanel key={eventId} eventId={eventId} />}

            {/* 계약 대기 안내 — 운영 화면의 첫 자리를 차지하지 않게 맨 아래에 접어 둔다 */}
            <PolicyPendingNotice />
        </div>
    );
}
