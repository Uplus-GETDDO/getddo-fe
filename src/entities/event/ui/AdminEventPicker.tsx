import { X } from 'lucide-react';
import { useEffect, useId, useState } from 'react';
import { z } from 'zod';

import { badgeVariants } from '@shared/ui/badge';
import { Button } from '@shared/ui/button';
import { TextFilter } from '@shared/ui/filter-fields';
import { useFilterRowClose, useInFilterRow } from '@shared/ui/filter-panel';
import { cn } from '@shared/utils/cn';
import { formatKstFullDot } from '@shared/utils/date';

import { useAdminEvent, useAdminEvents } from '../api/adminQueries';
import { ADMIN_STATUS_META } from '../model/adminStatusMeta';

const SEARCH_DELAY_MS = 300;
const isUuid = (value: string) => z.uuid().safeParse(value).success;

/**
 * 이벤트 고르기 — 관리자는 이벤트 UUID를 외우지 않는다. 이름을 치면 후보(AE01 keyword)를 펼쳐 고르게 하고,
 * 다른 화면에서 복사한 ID를 붙여 넣어도 그대로 받는다. 고른 뒤에는 칸 대신 이벤트 이름 칩을 보인다
 */
export function AdminEventPicker({
    eventId,
    onChange,
    label = '이벤트 찾기',
    suggest = false,
}: {
    /** 고른 이벤트 — 비었으면 찾기 칸을 보인다 */
    eventId: string;
    onChange: (eventId: string) => void;
    label?: string;
    /**
     * 검색어가 비었을 때 최근 등록한 이벤트를 후보로 펼쳐 둔다 — 배너처럼 '방금 만든 이벤트를 연결'하는 일이 많은 곳.
     * 이벤트가 수천 건이어도 목록 전체를 받지 않고, 최근 몇 건과 이름 검색(서버 AE01 keyword)으로 찾는다
     */
    suggest?: boolean;
}) {
    const listId = useId();
    // 필터 알약 창 안에서 쓰면 고른 뒤 창을 닫는다
    const close = useFilterRowClose();
    const inRow = useInFilterRow();
    const [text, setText] = useState('');
    const [keyword, setKeyword] = useState('');
    // 칠 때마다 요청하지 않고 멈춘 뒤 한 번 찾는다
    useEffect(() => {
        const timer = setTimeout(() => setKeyword(text.trim()), SEARCH_DELAY_MS);
        return () => clearTimeout(timer);
    }, [text]);

    const searching = keyword !== '' && !isUuid(keyword);
    const listing = searching || (suggest && keyword === '');
    const candidates = useAdminEvents({
        page: 1,
        size: 8,
        keyword: searching ? keyword : undefined,
        sort: 'createdAt,desc',
    });
    // URL·붙여 넣기로 ID만 들어온 경우 이름을 따로 받는다 — 삭제된 이벤트면 ID만 보인다
    const selected = useAdminEvent(eventId);

    if (eventId) {
        const event = selected.data;
        const status = event ? ADMIN_STATUS_META[event.status] : null;
        return (
            <div className="border-border-default bg-surface-canvas flex max-w-full min-w-0 items-center gap-3 rounded-lg border py-1.5 pr-1.5 pl-3">
                <div className="flex min-w-0 flex-col">
                    <span className="text-body-sm-bold text-fg-primary truncate">
                        {event?.title ?? '이벤트'}
                    </span>
                    <span className="text-caption text-fg-tertiary truncate">{eventId}</span>
                </div>
                {status && (
                    <span className={cn(badgeVariants({ variant: null }), status.chipClass)}>
                        {status.label}
                    </span>
                )}
                <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label="이벤트 선택 해제"
                    onClick={() => {
                        setText('');
                        onChange('');
                    }}
                >
                    <X aria-hidden />
                </Button>
            </div>
        );
    }

    const items = listing ? (candidates.data?.items ?? []) : [];
    return (
        <div className={cn('relative w-full max-w-xl', inRow && 'w-80')}>
            <TextFilter
                value={text}
                onChange={(value) => {
                    setText(value);
                    // 붙여 넣은 ID는 고를 필요 없이 바로 쓴다
                    if (isUuid(value.trim())) {
                        onChange(value.trim());
                        close();
                    }
                }}
                placeholder="이벤트 이름으로 찾기 (ID 붙여 넣기도 돼요)"
                label={label}
                className="w-full"
            />
            {listing && (
                <ul
                    id={listId}
                    role="listbox"
                    aria-label={`${label} 결과`}
                    className={cn(
                        'flex max-h-80 w-full flex-col overflow-y-auto',
                        inRow
                            ? '-mx-1 mt-2'
                            : suggest
                              ? 'border-border-default mt-2 max-h-64 rounded-xl border p-1'
                              : 'bg-surface-page border-border-default absolute top-full z-20 mt-1 rounded-xl border p-1 shadow-lg',
                    )}
                >
                    {suggest && !searching && (
                        <li className="text-caption text-fg-tertiary px-3 pt-1.5 pb-1">
                            최근 등록한 이벤트 · 이름을 치면 전체에서 찾아요
                        </li>
                    )}
                    {candidates.isPending && (
                        <li className="text-body-sm text-fg-tertiary px-3 py-2">찾는 중…</li>
                    )}
                    {!candidates.isPending && searching && items.length === 0 && (
                        <li className="text-body-sm text-fg-tertiary px-3 py-2">
                            &lsquo;{keyword}&rsquo;와(과) 맞는 이벤트가 없어요
                        </li>
                    )}
                    {items.map((event) => {
                        const status = ADMIN_STATUS_META[event.status];
                        return (
                            <li key={event.id} role="option" aria-selected={false}>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setText('');
                                        onChange(event.id);
                                        close();
                                    }}
                                    className="hover:bg-surface-sunken focus-visible:bg-surface-sunken flex w-full cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-left focus-visible:outline-none"
                                >
                                    <span className="flex min-w-0 flex-1 flex-col">
                                        <span className="text-body-sm-bold text-fg-primary truncate">
                                            {event.title}
                                        </span>
                                        <span className="text-caption text-fg-tertiary tabular-nums">
                                            {formatKstFullDot(event.startsAt)} ~{' '}
                                            {formatKstFullDot(event.endsAt)}
                                        </span>
                                    </span>
                                    <span
                                        className={cn(
                                            badgeVariants({ variant: null }),
                                            status.chipClass,
                                        )}
                                    >
                                        {status.label}
                                    </span>
                                </button>
                            </li>
                        );
                    })}
                </ul>
            )}
        </div>
    );
}

/** 고른 이벤트의 이름 — 필터 알약처럼 ID만 들고 있는 곳에서 이름을 보인다. 못 받으면 ID 앞자리 */
export function AdminEventTitle({ eventId }: { eventId: string }) {
    const { data } = useAdminEvent(eventId);
    return <>{data?.title ?? `${eventId.slice(0, 8)}…`}</>;
}
