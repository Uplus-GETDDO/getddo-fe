import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';

import type { Event } from '@entities/event';

import { useEntryStatistics } from '@entities/entry';
import { EnteredChip } from '@entities/event';
import { Badge } from '@shared/ui/badge';
import { Button } from '@shared/ui/button';
import { StatusDot } from '@shared/ui/status-dot';
import { KST_HOUR_MINUTE, formatKst } from '@shared/utils/date';
import { formatNumber } from '@shared/utils/format';

import { kstDayLabel } from '../utils/raffleFormat';
import { RaffleThumbnail } from './RaffleThumbnail';

/** 기본 화면에서 미리 보여 주는 줄 수 — 나머지는 '마감한 래플' 화면에서 본다 */
const PREVIEW_COUNT = 3;
/** 마감한 래플 화면에서 '더 보기'를 누를 때마다 늘리는 줄 수 */
const PAGE_SIZE = 10;

interface ClosedRaffleListProps {
    /** 머리의 진행 칸이 스크롤해 올 위치 */
    id?: string;
    events: Event[];
    now: Date;
    /**
     * preview — 기본 화면 아래에 최근 몇 줄만 두고 '전체보기'로 마감한 래플 화면으로 넘긴다.
     * full — 마감한 래플 화면. 전부를 날짜별로 묶고 '더 보기'로 이어 붙인다
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
    const [shown, setShown] = useState(PAGE_SIZE);

    const limit = mode === 'preview' ? PREVIEW_COUNT : shown;
    const visible = events.slice(0, limit);

    // 날짜가 바뀌는 자리에만 '오늘 / 어제' 머리말을 넣는다
    const groups: { label: string; rows: Event[] }[] = [];
    for (const event of visible) {
        const label = kstDayLabel(event.endsAt, now);
        const last = groups.at(-1);
        if (last?.label === label) last.rows.push(event);
        else groups.push({ label, rows: [event] });
    }

    return (
        <section id={id} className="flex scroll-mt-24 flex-col gap-6">
            {mode === 'full' && (
                <div className="flex flex-col items-start gap-3">
                    <Button variant="link" size="text" onClick={onBack}>
                        <ChevronLeft />
                        진행 중인 래플 보기
                    </Button>
                    <div className="flex items-center gap-2">
                        <h2 className="text-title-3 text-fg-primary">마감한 래플</h2>
                        <Badge variant="neutral" size="sm">
                            {formatNumber(events.length)}
                        </Badge>
                    </div>
                </div>
            )}
            {mode === 'preview' && (
                <div className="flex items-center justify-between gap-4">
                    <h2 className="text-title-3 text-fg-primary">마감한 래플</h2>
                    {events.length > PREVIEW_COUNT && (
                        <Button variant="link" size="text" onClick={onShowAll}>
                            전체보기
                            <ChevronRight />
                        </Button>
                    )}
                </div>
            )}

            {events.length === 0 ? (
                <p className="text-body-sm text-fg-tertiary">마감한 래플이 없어요.</p>
            ) : (
                <div className="flex flex-col">
                    {groups.map((group) => (
                        <div key={group.label} className="flex flex-col">
                            {/* 머리말은 줄 안의 썸네일과 같은 왼쪽 선(16px)에 맞춘다 */}
                            <p className="text-caption text-fg-tertiary px-4 pt-3.5 pb-0.5">
                                {group.label}
                            </p>
                            {/* 홈 '발표 대기 · 결과'와 같은 목록 — 구분선은 호버 배경과 같은 8px 안쪽에서 시작한다 */}
                            <ul className="[&>*+*]:before:bg-border-default flex flex-col [&>*+*]:relative [&>*+*]:before:absolute [&>*+*]:before:inset-x-2 [&>*+*]:before:top-0 [&>*+*]:before:h-px">
                                {group.rows.map((event) => (
                                    <ClosedRaffleRow key={event.id} event={event} now={now} />
                                ))}
                            </ul>
                        </div>
                    ))}
                    {mode === 'full' && events.length > shown && (
                        <Button
                            variant="secondary"
                            className="mt-4 self-center"
                            onClick={() => setShown((count) => count + PAGE_SIZE)}
                        >
                            더 보기
                        </Button>
                    )}
                </div>
            )}
        </section>
    );
}

function ClosedRaffleRow({ event, now }: { event: Event; now: Date }) {
    // 마감 이후라 값이 더 늘지 않는다 — 폴링 없이 행마다 1회 조회한다.
    // TODO: 행마다 E03을 부르는 구조는 최적화 대상이다 (Obsidian 20261008-progress-roadmap 참조)
    const { data: statistics } = useEntryStatistics(event.id);
    const isDrawn = event.status === 'drawn';
    // 발표 여부는 status로만 판단한다 — 예정 시각은 계약에 없고 실제 공개 전까지는 발표 대기다 (ADR-022)
    const statusLabel = isDrawn ? '발표 완료' : '발표 대기';

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
                        <StatusDot tone={isDrawn ? 'muted' : 'info'}>{statusLabel}</StatusDot>
                        {/* 마감해서 더는 응모할 수 없다 — 여기서는 '응모 완료'가 맞는 말이다 */}
                        {event.myEntered && <EnteredChip label="응모 완료" />}
                    </div>
                    <p className="text-body-bold text-fg-primary truncate">{event.title}</p>
                    <p className="text-caption text-fg-tertiary">{meta.join(' · ')}</p>
                </div>
                <ChevronRight className="text-fg-secondary group-hover:text-fg-primary size-7 shrink-0 motion-safe:transition-transform motion-safe:duration-200 motion-safe:group-hover:translate-x-1" />
            </Link>
        </li>
    );
}
