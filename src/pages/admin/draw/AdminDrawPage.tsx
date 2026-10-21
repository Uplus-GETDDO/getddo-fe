import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import type { AdminEventStatus, EventType } from '@entities/event';

import { ADMIN_STATUS_META, useAdminEventsByStatus } from '@entities/event';
import { Button } from '@shared/ui/button';
import { DateRangeFilter, OptionFilter } from '@shared/ui/filter-fields';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@shared/ui/select';
import { CardSkeleton, LoadingBlock } from '@shared/ui/skeleton';

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
    { value: 'all', label: '전체 유형' },
    { value: 'TICKET', label: '겟또타임' },
    { value: 'NO_TICKET', label: '이벤트' },
];
// 상세에서 가장 먼저 보는 값은 추첨 단계라 단계를 필터로 둔다 — 손이 먼저 가야 하는 순서대로
const STAGE_OPTIONS: { value: 'all' | AdminEventStatus; label: string }[] = [
    { value: 'all', label: '전체 단계' },
    ...DRAW_STATUSES.map((value) => ({
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
    // 유형·등록일·단계 모두 서버(AE01)가 거른다 — 상태 필터가 하나만 받아 단계마다 따로 불러 합친다.
    // 앞쪽 100건만 받아 화면에서 단계를 거르면 뒤쪽 쪽에 있는 추첨 대상이 빠질 수 있다
    const { items, truncated, isPending, isError } = useAdminEventsByStatus(
        stage === 'all' ? DRAW_STATUSES : [stage],
        {
            page: 1,
            size: EVENT_PICKER_SIZE,
            eventType: kind === 'all' ? undefined : kind,
            createdFrom: createdFrom && !createdRangeError ? createdFrom : undefined,
            createdTo: createdTo && !createdRangeError ? createdTo : undefined,
        },
    );
    const filtered = kind !== 'all' || stage !== 'all' || createdFrom !== '' || createdTo !== '';

    // 기간이 잘못되면 날짜 조건 없이 불러온 목록이라 보여 주지 않는다 (기간 입력칸이 오류를 알린다)
    const events = (createdRangeError ? [] : [...items]).sort(
        (a, b) => (DRAW_PRIORITY[a.status] ?? 9) - (DRAW_PRIORITY[b.status] ?? 9),
    );
    // 상세 화면 등에서 URL로 들어온 이벤트는 목록 조건과 무관하게 열 수 있어야 한다
    const selectedInList = events.some((e) => e.id === eventId);

    return (
        <div className="flex flex-col gap-6 pb-10 md:pr-10">
            {/* '추첨 관리' 설명 기본안 — 이 화면이 하는 일을 한 줄로 말해 준다 */}
            <p className="text-body-sm text-fg-secondary">
                추첨 결과를 검토하고, 필요한 당첨 취소·재추첨을 진행한 뒤 당첨자를 공개합니다.
            </p>
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
                {/* 고른 뒤에는 거르기·표가 숨으므로 목록으로 돌아가는 길을 둔다 — 거르기 값은 그대로 남는다 */}
                {eventId && (
                    <Button variant="ghost" size="sm" onClick={() => setSearchParams({})}>
                        목록으로
                    </Button>
                )}
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
            {!isPending && !isError && !createdRangeError && events.length === 0 && !eventId && (
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
            {!eventId && truncated && (
                <p className="text-caption text-fg-tertiary">
                    단계마다 최근 {EVENT_PICKER_SIZE}건까지 보여요. 더 찾으려면 유형·등록일로 좁혀
                    보세요.
                </p>
            )}

            {eventId && <DrawEventPanel key={eventId} eventId={eventId} />}

            {/* 계약 대기 안내 — 운영 화면의 첫 자리를 차지하지 않게 맨 아래에 접어 둔다 */}
            <PolicyPendingNotice />
        </div>
    );
}
