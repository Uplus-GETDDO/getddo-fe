import { Clock, Ticket, Timer } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import { useVirtualClock } from '@shared/model/virtualClock';
import { Button } from '@shared/ui/button';
import { Card } from '@shared/ui/card';
import { formatKstTimeRange, formatRemaining } from '@shared/utils/date';
import { formatNumber } from '@shared/utils/format';

import type { Event } from '../model/types';

import { eventDetailPath } from '../utils/eventPath';
import { EventThumbnail } from './EventThumbnail';

interface FeaturedEventCardProps {
    event: Event;
    /**
     * 응모 현황(E03) — entities끼리는 서로 참조할 수 없어 호출하는 위젯이 조회해 내려준다.
     * 값이 없으면 해당 칸은 숨긴다
     */
    participantCount?: number;
    totalSpentTicketCount?: number;
    /** 내가 이 래플에 쓴 응모권 — E03이 정확한 값을 준다. 회차 × 장수로 어림하면 여러 장 응모를 적게 센다 */
    mySpentTicketCount?: number;
}

/** 마감까지 남은 시간을 다시 셈하는 주기 — 분 단위로 적으니 30초면 충분하다 */
const TICK_MS = 30 * 1000;

function useRemainingMs(endsAt: string): number {
    const { now } = useVirtualClock();
    const [tick, setTick] = useState(() => now().getTime());
    useEffect(() => {
        const update = () => setTick(now().getTime());
        update();
        const id = setInterval(update, TICK_MS);
        return () => clearInterval(id);
    }, [now]);
    return new Date(endsAt).getTime() - tick;
}

/**
 * 홈 '겟또타임 · 응모권 사용' 섹션의 대표 진행 래플 카드 — 마감이 가장 임박한 open 래플 1개를 크게 노출한다.
 *
 * 겟또타임 목록의 대표 카드와 같은 말투로 맞춘다: 윗줄은 '● 진행중 · 시간 · 남은 시간', 숫자는 아이콘 칸 대신 한 줄.
 * 당첨 인원은 제목 옆 괄호 대신 숫자 줄에 '당첨 N명'으로 적는다 — 괄호만으로는 당첨인지 참여인지 헷갈렸다.
 * 내 응모는 응모했을 때만 응모권 칩으로 보인다 — 응모하지 않은 사람에게 빈 칸을 보이지 않는다.
 */
export function FeaturedEventCard({
    event,
    participantCount,
    totalSpentTicketCount,
    mySpentTicketCount,
}: FeaturedEventCardProps) {
    const remainingMs = useRemainingMs(event.endsAt);

    // 이름 위·값 아래로 세 칸 — 한 줄로 이어 쓰면 숫자가 문장에 묻혀 눈에 안 들어왔다
    const stats = [
        // 경품 요약은 상세(E02)에만 있다 — 목록만으로 만든 이벤트는 당첨 인원이 없다 (spec EventSummary)
        {
            label: '당첨',
            value: event.winnerCount != null ? `${formatNumber(event.winnerCount)}명` : '-',
        },
        {
            label: '참여',
            value: participantCount != null ? `${formatNumber(participantCount)}명` : '-',
        },
        {
            label: '사용된 응모권',
            value: totalSpentTicketCount != null ? `${formatNumber(totalSpentTicketCount)}장` : '-',
        },
    ];

    return (
        <Card size="lg" className="gap-5 p-(--card-spacing)">
            <div className="flex gap-5">
                <div className="flex min-w-0 flex-1 flex-col gap-3">
                    <div className="text-body-sm flex flex-wrap items-center gap-x-3 gap-y-1">
                        <span className="text-fg-primary flex items-center gap-1.5">
                            <span aria-hidden className="bg-brand-primary size-1.5 rounded-full" />
                            진행중
                        </span>
                        {/* 남은 시간이 판단에 더 쓰이는 값이라 진하게, 운영 시간은 보조색으로 뒤에 둔다 */}
                        {remainingMs > 0 && (
                            <span className="text-fg-primary text-body-sm-bold flex items-center gap-1 tabular-nums">
                                <Timer aria-hidden className="size-3.5" />
                                {formatRemaining(remainingMs, 'minute')} 남음
                            </span>
                        )}
                        <span className="text-fg-tertiary flex items-center gap-1 tabular-nums">
                            <Clock aria-hidden className="size-3.5" />
                            {formatKstTimeRange(event.startsAt, event.endsAt)}
                        </span>
                    </div>
                    <div className="flex flex-col gap-1.5">
                        <p className="text-title-3 text-fg-primary line-clamp-2">{event.title}</p>
                        <p className="text-body-sm text-fg-secondary line-clamp-2 break-keep">
                            {event.description}
                        </p>
                    </div>
                    <dl className="divide-border-default mt-1 grid grid-cols-3 divide-x">
                        {stats.map(({ label, value }) => (
                            <div key={label} className="flex flex-col gap-0.5 px-3 first:pl-0">
                                <dt className="text-caption text-fg-tertiary">{label}</dt>
                                <dd className="text-subhead text-fg-primary tabular-nums">
                                    {value}
                                </dd>
                            </div>
                        ))}
                    </dl>
                    {mySpentTicketCount != null && mySpentTicketCount > 0 && (
                        <span className="bg-ticket-accent text-fg-primary text-caption flex w-fit items-center gap-1.5 rounded-full px-2.5 py-1">
                            <Ticket aria-hidden className="size-3.5" />
                            응모권 {formatNumber(mySpentTicketCount)}장으로 응모했어요
                        </span>
                    )}
                </div>
                {/* 상품 그림은 1:1(DESIGN-SYSTEM '이미지 비율')이되 작게 — 크게 두면 설명이 짧을 때 왼쪽이 텅 빈다 */}
                <EventThumbnail
                    src={event.bannerImageUrl}
                    className="size-24 rounded-xl sm:size-36"
                />
            </div>
            {/* 상세로 이동하는 버튼은 주 행동(검정) — 카드 아래에 붙여 글 길이가 달라도 같은 자리에 둔다 */}
            <Button asChild size="lg" className="mt-auto w-full">
                <Link to={eventDetailPath(event)}>응모하러 가기</Link>
            </Button>
        </Card>
    );
}
