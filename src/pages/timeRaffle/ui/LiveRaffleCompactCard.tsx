import { Link } from 'react-router-dom';

import type { Event } from '@entities/event';

import { useEntryStatistics } from '@entities/entry';
import { EnteredChip } from '@entities/event';
import { Button } from '@shared/ui/button';
import { formatNumber } from '@shared/utils/format';

import { CloseCountdownChip } from './CloseCountdownChip';
import { RaffleThumbnail } from './RaffleThumbnail';

/**
 * 진행 중 래플 중 대표 카드 아래에 함께 보여 주는 작은 카드.
 *
 * 예전에는 좌우 화살표로 한 번에 하나만 보여 줬는데, 래플은 동시에 여러 개가 열리고
 * 마감이 제각각이라 넘겨 보는 동안 다른 래플이 끝날 수 있다. 전부 한눈에 둔다.
 */
export function LiveRaffleCompactCard({ event }: { event: Event }) {
    // 폴링은 대표 카드 하나만 한다 (ADR-0007). 작은 카드까지 30초마다 부르면
    // 진행 중 래플 수만큼 E03 요청이 늘어나는데, 여기서 보여 주는 건 참여자 수 한 줄뿐이다
    const { data: statistics } = useEntryStatistics(event.id);

    return (
        <article className="bg-surface-page border-border-default flex items-center gap-5 rounded-2xl border p-5 shadow-md">
            <RaffleThumbnail src={event.bannerImageUrl} className="w-32 shrink-0 rounded-xl" />

            <div className="flex min-w-0 flex-1 flex-col gap-2">
                <div className="flex flex-wrap items-center gap-2">
                    <span className="text-body-sm text-fg-primary flex items-center gap-1.5">
                        <span className="bg-brand-primary size-1.5 rounded-full" />
                        진행중
                    </span>
                    <CloseCountdownChip endsAt={event.endsAt} size="sm" />
                    {/* 겟또타임은 한도까지 더 쓸 수 있다 — '완료'라고 적으면 버튼이 죽은 줄 알고 들어오지 않는다 */}
                    {event.myEntered && <EnteredChip label="참여 중" />}
                </div>

                <h3 className="text-subhead text-fg-primary truncate">{event.title}</h3>

                {/* 목록 응답에는 경품이 없어 당첨 인원을 모를 수 있다 — 모르면 참여 수만 적는다 */}
                <p className="text-caption text-fg-tertiary">
                    {event.winnerCount != null && `당첨 ${formatNumber(event.winnerCount)}명`}
                    {event.winnerCount != null && statistics && ' · '}
                    {statistics && `${formatNumber(statistics.participantCount)}명 참여 중`}
                </p>

                {/* 카드마다 반복되는 이동이라 secondary — 검정 버튼은 대표 카드 하나에만 둬 시선을 모은다 (DESIGN-SYSTEM 13절) */}
                <Button asChild variant="secondary" className="mt-1 w-full">
                    <Link to={`/time-raffle/${event.id}`}>응모하러 가기</Link>
                </Button>
            </div>
        </article>
    );
}
