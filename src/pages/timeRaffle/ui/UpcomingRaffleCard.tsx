import { Link } from 'react-router-dom';

import type { Event } from '@entities/event';

import { Button } from '@shared/ui/button';
import { KST_HOUR_MINUTE, formatKst } from '@shared/utils/date';

import { formatEntryRule, formatOpenChip } from '../utils/raffleFormat';
import { RaffleThumbnail } from './RaffleThumbnail';

/** 이 시간 안에 열리면 '곧 오픈'으로 마젠타 점을 찍는다 — "지금" 신호 (DESIGN-SYSTEM 13절) */
const SOON_MS = 30 * 60 * 1000;

interface UpcomingRaffleCardProps {
    event: Event;
    now: Date;
    /** ADR-010 누적 한도 — 여러 장 응모가 가능한지 판단한다 */
    ticketLimit: number;
}

export function UpcomingRaffleCard({ event, now, ticketLimit }: UpcomingRaffleCardProps) {
    const untilOpen = new Date(event.startsAt).getTime() - now.getTime();
    const soon = untilOpen > 0 && untilOpen <= SOON_MS;

    return (
        <article className="bg-surface-elevated border-border-default relative flex flex-col justify-between gap-4 rounded-2xl border p-5 shadow-md">
            {/* 카드 어디를 눌러도 상세로 간다 — 키보드·스크린 리더는 아래 버튼 하나로 들어간다 */}
            <Link
                to={`/time-raffle/${event.id}`}
                aria-hidden
                tabIndex={-1}
                className="absolute inset-0 z-1 rounded-2xl"
            />
            {/*
             * 상품 그림은 1:1 썸네일로 옆에 둔다 — 카드 폭 전체에 그림을 깔면 그림 없는 래플은 회색 칸이 카드 절반이 됐다
             */}
            <div className="flex items-start gap-4">
                <RaffleThumbnail src={event.bannerImageUrl} className="w-24 rounded-xl" />
                <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                    {soon ? (
                        <span className="text-caption text-fg-primary flex w-fit items-center gap-1.5 py-1">
                            <span className="bg-brand-primary size-1.5 rounded-full" />
                            {formatKst(event.startsAt, KST_HOUR_MINUTE)} 곧 오픈
                        </span>
                    ) : (
                        <span className="bg-surface-sunken text-caption text-fg-secondary w-fit rounded-full px-2.5 py-1">
                            {formatOpenChip(event, now)}
                        </span>
                    )}
                    <h3 className="text-subhead text-fg-primary line-clamp-2">{event.title}</h3>
                    <p className="text-caption text-fg-tertiary">
                        {formatEntryRule(event, ticketLimit)}
                    </p>
                </div>
            </div>

            {/*
             * 오픈 전에도 상세에서 상품·일정·규칙을 미리 볼 수 있게 한다.
             * TODO: 오픈 알림 구독은 API 계약이 없다 (getddo-spec 05-api/notification.md의 N01~N03은 조회·읽음뿐).
             * 계약이 생기면 상세에 '오픈 알림 받기'를 붙인다 — 그전에는 알림이 갈 것처럼 보이는 버튼을 두지 않는다
             */}
            <Button asChild variant="secondary" className="relative z-2 w-full">
                <Link to={`/time-raffle/${event.id}`}>자세히 보기</Link>
            </Button>
        </article>
    );
}
