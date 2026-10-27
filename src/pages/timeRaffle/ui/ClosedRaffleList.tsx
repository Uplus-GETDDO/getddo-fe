import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';

import type { Event } from '@entities/event';

import { useEntryStatistics } from '@entities/entry';
import { EnteredChip } from '@entities/event';
import { Badge } from '@shared/ui/badge';
import { Button } from '@shared/ui/button';
import { Pagination } from '@shared/ui/pagination';
import { StatusDot } from '@shared/ui/status-dot';
import { KST_HOUR_MINUTE, formatKst } from '@shared/utils/date';
import { formatNumber } from '@shared/utils/format';
import { pageSlice } from '@shared/utils/pagination';

import { kstDayLabel } from '../utils/raffleFormat';
import { RaffleThumbnail } from './RaffleThumbnail';

/** 기본 화면에서 미리 보여 주는 줄 수 — 나머지는 전체보기(마감한 래플 화면)에서 본다 */
const PREVIEW_COUNT = 3;
/** 마감한 래플 화면 한 쪽의 줄 수 */
const PAGE_SIZE = 10;

interface ClosedRaffleListProps {
    /** 머리의 진행 칸이 스크롤해 올 위치 */
    id?: string;
    events: Event[];
    now: Date;
    /**
     * preview — 기본 화면 아래에 최근 마감 몇 줄만 두고 '전체보기'로 마감한 래플 화면으로 넘긴다.
     * full — 마감한 래플 화면. 최근 마감 순 한 목록을 10줄씩 번호로 넘긴다
     */
    mode: 'preview' | 'full';
    /** preview의 '전체보기' — 페이지를 옮기지 않고 내용 칸만 마감한 래플로 바꾼다 */
    onShowAll?: () => void;
    /** full의 '뒤로' — 기본 화면으로 칸을 되돌린다 */
    onBack?: () => void;
}

export function ClosedRaffleList({
    id,
    events,
    now,
    mode,
    onShowAll,
    onBack,
}: ClosedRaffleListProps) {
    const [page, setPage] = useState(1);
    const paged = pageSlice(events, page, PAGE_SIZE);

    // 오늘·어제로 나누지 않고 최근 마감 순 한 목록 — 날짜는 줄마다 '오늘 16:28 마감'으로 적혀 있다
    const visible = mode === 'preview' ? events.slice(0, PREVIEW_COUNT) : paged.items;

    return (
        <section id={id} className="flex scroll-mt-24 flex-col gap-6">
            {mode === 'full' && (
                <div className="flex flex-col items-start gap-3">
                    <Button variant="link" size="text" onClick={onBack}>
                        <ChevronLeft />
                        진행 중인 겟또타임 보기
                    </Button>
                    <div className="flex items-center gap-2">
                        <h2 className="text-title-3 text-fg-primary">마감한 겟또타임</h2>
                        <Badge variant="neutral" size="sm">
                            {formatNumber(events.length)}
                        </Badge>
                    </div>
                </div>
            )}
            {mode === 'preview' && (
                <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-2">
                        <h2 className="text-title-3 text-fg-primary">마감한 겟또타임</h2>
                        {events.length > 0 && (
                            <Badge variant="neutral" size="sm">
                                {formatNumber(events.length)}
                            </Badge>
                        )}
                    </div>
                    {events.length > PREVIEW_COUNT && (
                        <Button variant="link" size="text" onClick={onShowAll}>
                            전체보기
                            <ChevronRight />
                        </Button>
                    )}
                </div>
            )}

            {events.length === 0 ? (
                <p className="text-body-sm text-fg-tertiary">마감한 겟또타임이 없어요.</p>
            ) : (
                <div className="flex flex-col">
                    {/* 홈 '발표 대기 · 결과'와 같은 목록 — 구분선은 호버 배경과 같은 8px 안쪽에서 시작한다 */}
                    <ul className="[&>*+*]:before:bg-border-default flex flex-col [&>*+*]:relative [&>*+*]:before:absolute [&>*+*]:before:inset-x-2 [&>*+*]:before:top-0 [&>*+*]:before:h-px">
                        {visible.map((event) => (
                            <ClosedRaffleRow key={event.id} event={event} now={now} />
                        ))}
                    </ul>
                    {mode === 'full' && paged.totalPages > 1 && (
                        <Pagination
                            page={paged.current}
                            totalPages={paged.totalPages}
                            onPageChange={(next) => {
                                setPage(next);
                                // 새 쪽은 목록 머리부터 읽게 올린다
                                if (id)
                                    document
                                        .getElementById(id)
                                        ?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
                            }}
                            label="마감한 겟또타임 페이지"
                            className="justify-center pt-4"
                        />
                    )}
                </div>
            )}
        </section>
    );
}

function ClosedRaffleRow({ event, now }: { event: Event; now: Date }) {
    // 마감 이후라 값이 더 늘지 않는다 — 폴링 없이 행마다 1회 조회하고, 받으면 참여 인원만 설명 줄에 붙인다.
    // 조회 시각·갱신 실패 줄은 두지 않는다 — 바뀌지 않는 값이라 '마지막 성공' 시각이 무슨 뜻인지 읽히지 않았다
    const { data: statistics } = useEntryStatistics(event.id);
    const isDrawn = event.status === 'drawn';
    // 발표 여부는 status로만 판단한다 — 예정 시각은 계약에 없고 실제 공개 전까지는 발표 대기다 (ADR-022)
    const statusLabel =
        event.status === 'canceled'
            ? '이벤트 취소'
            : event.status === 'ended'
              ? '추첨 없이 종료'
              : isDrawn
                ? '발표 완료'
                : '발표 대기';

    const meta = [
        `${kstDayLabel(event.endsAt, now)} ${formatKst(event.endsAt, KST_HOUR_MINUTE)} 마감`,
        // 목록 응답에는 경품이 없어 당첨 인원을 모를 수 있다 (spec EventSummary)
        event.winnerCount != null ? `당첨 ${formatNumber(event.winnerCount)}명` : null,
        statistics ? `${formatNumber(statistics.participantCount)}명 참여` : null,
    ].filter(Boolean);

    return (
        <li>
            {/*
             * 홈 '발표 대기 · 결과' 줄(EventResultRow)과 같은 꼴 — 줄 전체를 누르는 링크, 16:9 썸네일, 상태 점, 오른쪽 화살표.
             * 발표 전이라도 상세로 들어갈 수 있어야 한다 — 상세는 발표까지 남은 시간과 내 응모 현황을 보여 준다
             */}
            <Link
                to={`/time-raffle/${event.id}`}
                className="group focus-visible:ring-border-focus focus-visible:ring-offset-surface-page after:bg-surface-canvas/60 relative isolate flex items-center gap-4 rounded-2xl p-4 after:absolute after:inset-2 after:-z-10 after:rounded-xl after:opacity-0 hover:after:opacity-100 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none motion-safe:after:transition-opacity motion-safe:after:duration-200"
            >
                <RaffleThumbnail
                    src={event.bannerImageUrl}
                    className="aspect-video h-20 rounded-lg"
                />
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                    {/* 내 당첨 여부는 결과 화면에서 본다 — 목록에는 발표 상태만 둔다. 발표 전만 "지금" 신호 점을 찍는다 */}
                    <div className="flex flex-wrap items-center gap-2">
                        <StatusDot tone={event.status === 'closed' ? 'info' : 'muted'}>
                            {statusLabel}
                        </StatusDot>
                        {/* 마감해서 더는 응모할 수 없다 — 여기서는 '응모 완료'가 맞는 말이다 */}
                        {event.myEntered && <EnteredChip label="응모 완료" />}
                    </div>
                    <p className="text-body-bold text-fg-primary truncate">{event.title}</p>
                    <p className="text-caption text-fg-tertiary">{meta.join(' · ')}</p>
                </div>
                {/* 줄 호버는 배경만 바뀐다 — 화살표까지 움직이면 줄이 흔들려 보였다 */}
                <ChevronRight className="text-fg-secondary group-hover:text-fg-primary size-7 shrink-0" />
            </Link>
        </li>
    );
}
