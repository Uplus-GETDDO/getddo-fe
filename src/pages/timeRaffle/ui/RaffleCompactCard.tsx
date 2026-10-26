import { Clock } from 'lucide-react';
import { Link } from 'react-router-dom';

import type { Event } from '@entities/event';

import { useEntryStatistics } from '@entities/entry';
import { RaffleEntryChip } from '@entities/event';
import { Button } from '@shared/ui/button';
import { formatNumber } from '@shared/utils/format';

import { formatEntryRule, formatOpenChip } from '../utils/raffleFormat';
import { CloseCountdownChip } from './CloseCountdownChip';
import { RaffleThumbnail } from './RaffleThumbnail';

/** 이 시간 안에 열리면 '곧 오픈'을 브랜드색 점으로 알린다 — "지금" 신호 (DESIGN-SYSTEM 13절) */
const SOON_MS = 30 * 60 * 1000;

/**
 * 겟또타임 작은 카드 — 진행 중(대표 카드 아래)과 오픈 예정이 같은 카드를 쓴다.
 * 같은 '래플 한 개'를 단계만 달리 보여 주는 것이라 그림·상태 줄·제목·한 줄 정보·버튼 자리를 똑같이 두고,
 * 상태 줄과 버튼 문구만 바꾼다 (멘토링 — 같은 역할이면 같은 컴포넌트).
 *
 * - 진행 중: ● 진행중 · 남은 시간 / 참여 인원 / 응모하러 가기
 * - 오픈 예정: ● 오픈 예정 · 여는 시각 (30분 안이면 브랜드색 '곧 오픈') / 응모 규칙 / 자세히 보기
 *
 * wide는 두 칸 줄을 혼자 채우는 카드 — 버튼을 오른쪽에 둬 끝없이 늘어나지 않게 한다
 */
export function RaffleCompactCard({
    event,
    phase,
    now,
    ticketLimit,
    wide = false,
}: {
    event: Event;
    phase: 'live' | 'upcoming';
    /** 오픈 예정의 '오늘/내일' 표기와 곧 오픈 판정 기준 */
    now: Date;
    /** ADR-010 누적 한도 — 오픈 예정의 응모 규칙 문구에 쓴다 */
    ticketLimit: number;
    wide?: boolean;
}) {
    const live = phase === 'live';
    // 폴링은 대표 카드 하나만 한다 (ADR-0007). 작은 카드는 참여 인원 한 줄만 1회 받는다 — 오픈 전에는 셀 게 없다
    const { data: statistics } = useEntryStatistics(event.id, { enabled: live });
    const untilOpen = new Date(event.startsAt).getTime() - now.getTime();
    const soon = !live && untilOpen > 0 && untilOpen <= SOON_MS;

    const meta = live
        ? [
              // 목록 응답에는 경품이 없어 당첨 인원을 모를 수 있다 — 모르면 참여 수만 적는다
              event.winnerCount != null ? `당첨 ${formatNumber(event.winnerCount)}명` : null,
              statistics ? `${formatNumber(statistics.participantCount)}명 참여 중` : null,
          ]
              .filter(Boolean)
              .join(' · ')
        : formatEntryRule(event, ticketLimit);

    // 카드마다 반복되는 이동이라 secondary — 검정·노랑 버튼은 대표 카드 하나에만 둬 시선을 모은다 (DESIGN-SYSTEM 13절).
    // 오픈 전에는 응모할 수 없어 상세(상품·일정·규칙)를 미리 보는 '자세히 보기'
    const action = (className: string) => (
        <Button asChild variant="secondary" className={`relative z-2 ${className}`}>
            <Link to={`/time-raffle/${event.id}`}>{live ? '응모하러 가기' : '자세히 보기'}</Link>
        </Button>
    );

    return (
        <article
            className={`bg-surface-page border-border-default group relative flex items-center gap-5 rounded-2xl border p-5 shadow-md ${wide ? 'lg:col-span-2' : ''}`}
        >
            {/* 카드 어디를 눌러도 상세로 — 버튼과 같은 곳이라 낭독기·키보드에서는 감추고 버튼 하나로만 읽힌다 (게임 카드와 같은 방식) */}
            <Link
                to={`/time-raffle/${event.id}`}
                aria-hidden
                tabIndex={-1}
                className="absolute inset-0 z-1 rounded-2xl"
            />
            <RaffleThumbnail
                src={event.bannerImageUrl}
                className="w-32 shrink-0 rounded-xl [&_img]:transition-transform [&_img]:duration-300 motion-safe:group-hover:[&_img]:scale-105"
            />

            <div className="flex min-w-0 flex-1 flex-col gap-2">
                <div className="flex flex-wrap items-center gap-2">
                    <span className="text-body-sm text-fg-primary flex items-center gap-1.5">
                        <span
                            className={`size-1.5 rounded-full ${live || soon ? 'bg-brand-primary' : 'bg-fg-disabled'}`}
                        />
                        {live ? '진행중' : soon ? '곧 오픈' : '오픈 예정'}
                    </span>
                    {live ? (
                        <CloseCountdownChip endsAt={event.endsAt} size="sm" />
                    ) : (
                        <span className="text-caption text-fg-secondary flex items-center gap-1 tabular-nums">
                            <Clock aria-hidden className="size-3.5" />
                            {formatOpenChip(event, now)}
                        </span>
                    )}
                    {/* 한도가 남았으면 '쓴 장수 + 응모 중', 다 썼으면 '응모 완료' — '완료'만 적으면 더 쓸 수 있는데 버튼이 죽은 줄 안다 */}
                    {live && (
                        <RaffleEntryChip
                            event={event}
                            mySpentTicketCount={statistics?.mySpentTicketCount}
                        />
                    )}
                </div>

                <h3 className="text-subhead text-fg-primary truncate">{event.title}</h3>
                {meta && <p className="text-caption text-fg-tertiary">{meta}</p>}

                {/* 두 칸을 차지하는 넓은 카드도 한 칸으로 쌓이는 좁은 화면(lg 아래)에서는 다른 카드처럼 글 아래 꽉 찬 버튼 */}
                {action(wide ? 'mt-1 w-full lg:hidden' : 'mt-1 w-full')}
            </div>
            {wide && action('hidden w-48 shrink-0 lg:inline-flex')}
        </article>
    );
}
