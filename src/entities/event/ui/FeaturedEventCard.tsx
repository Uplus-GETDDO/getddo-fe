import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import { useVirtualClock } from '@shared/model/virtualClock';
import { Badge } from '@shared/ui/badge';
import { Button } from '@shared/ui/button';
import { Card } from '@shared/ui/card';
import { formatKstTimeRange, formatRemaining } from '@shared/utils/date';
import { formatNumber } from '@shared/utils/format';

import type { Event } from '../model/types';

import { eventDetailPath } from '../utils/eventPath';
import { RaffleEntryChip } from './EnteredChip';
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

/** 마감까지 남은 시간을 다시 셈하는 주기 — 배너처럼 1시간 안쪽은 분·초까지 적어 1초마다 센다 */
const TICK_MS = 1000;

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

/** 1시간이 넘게 남으면 배너처럼 분까지만 센다 — 매초 바뀌지 않아 덜 흔들린다 */
const MINUTE_PRECISION_MS = 3_600_000;

/** 마지막 1시간은 '12:34'처럼 두 자리씩 고정해 센다 — '9분 5초'↔'10분 12초'처럼 글자 수가 바뀌지 않아 폭이 그대로다 */
function formatClock(remainingMs: number): string {
    const totalSeconds = Math.max(0, Math.floor(remainingMs / 1000));
    const pad = (value: number) => String(value).padStart(2, '0');
    return `${pad(Math.floor(totalSeconds / 60))}:${pad(totalSeconds % 60)}`;
}

/**
 * 마감까지 남은 시간 알약 — 배너의 마감 탭과 같은 말투('마감까지 …').
 * 1시간 넘게 남으면 분까지만('1시간 23분' — 1분에 한 번 바뀐다), 마지막 1시간은 '12:34'로 센다.
 * 자리를 미리 넓게 잡아 두면 남은 시간이 짧을 때 알약 안이 휑했다 — 글자 수가 바뀌지 않는 표기로 흔들림을 없앤다
 */
function CloseCountdown({ remainingMs }: { remainingMs: number }) {
    // 마감이 지나 목록이 다시 오기 전까지 — 탭을 지우면 윗줄이 비어 카드가 허전해서, 같은 자리에 마감을 알린다
    if (remainingMs <= 0) {
        return (
            <Badge
                variant="inverse"
                size="lg"
                className="-ml-(--card-spacing) rounded-l-none pl-(--card-spacing)"
            >
                응모 마감 · 곧 추첨해요
            </Badge>
        );
    }
    const label =
        remainingMs >= MINUTE_PRECISION_MS
            ? formatRemaining(remainingMs, 'minute')
            : formatClock(remainingMs);
    return (
        // '진행중' 글자 대신 알약 안의 번지는 점 — 마감까지 남았다는 말이 곧 진행 중이라 같은 말을 두 번 하지 않는다.
        // 겟또타임 '지금 진행 중' 머리와 같은 신호이고, 동작 줄이기 설정에선 멈춘 점만
        // 배너의 마감 탭처럼 카드 왼쪽 끝에 붙여 이어 나온 탭으로 — 카드 여백만큼 당기고 왼쪽 모서리는 각지게, 안쪽 글은 원래 자리에
        <Badge
            variant="inverse"
            size="lg"
            className="-ml-(--card-spacing) gap-2 rounded-l-none pl-(--card-spacing) tabular-nums"
        >
            <span aria-hidden className="relative flex size-2">
                <span className="bg-brand-primary absolute inset-0 rounded-full opacity-60 motion-safe:animate-ping" />
                <span className="bg-brand-primary relative size-2 rounded-full" />
            </span>
            <span className="sr-only">진행 중, </span>
            마감까지 {label}
        </Badge>
    );
}

/**
 * 홈 '겟또타임 · 응모권 사용' 섹션의 대표 진행 래플 카드 — 마감이 가장 임박한 open 래플 1개를 크게 노출한다.
 *
 * 윗줄은 '● 마감까지 N분' 알약(왼쪽)과 내 응모 칩(오른쪽), 그 아래 제목·여는 시간·설명. 숫자는 버튼 옆 작은 한 줄.
 * 당첨 인원은 제목 옆 괄호 대신 숫자 줄에 '당첨 N명'으로 적는다 — 괄호만으로는 당첨인지 참여인지 헷갈렸다.
 * 내 응모는 응모했을 때만 칩(RaffleEntryChip)으로 보인다 — 응모하지 않은 사람에게 빈 칸을 보이지 않는다.
 */
export function FeaturedEventCard({
    event,
    participantCount,
    totalSpentTicketCount,
    mySpentTicketCount,
}: FeaturedEventCardProps) {
    const remainingMs = useRemainingMs(event.endsAt);

    // 숫자는 판단을 거드는 정도라 버튼 옆 작은 한 줄로 — 칸으로 나누면 남은 시간·제목과 겨뤄 보였다.
    // 아직 모르는 값은 '-'로 자리를 채우지 않고 뺀다
    const stats = [
        // 경품 요약은 상세(E02)에만 있다 — 목록만으로 만든 이벤트는 당첨 인원이 없다 (spec EventSummary)
        event.winnerCount != null && `당첨 ${formatNumber(event.winnerCount)}명`,
        participantCount != null && `참여 ${formatNumber(participantCount)}명`,
        totalSpentTicketCount != null && `응모권 ${formatNumber(totalSpentTicketCount)}장`,
    ].filter((stat): stat is string => typeof stat === 'string');
    // 숫자를 아직 모르면(조회 전·실패) 줄이 텅 비어 허전했다 — 이벤트에 늘 있는 응모 조건으로 채운다
    const rules = [
        event.requiredTickets > 0 && `응모권 ${formatNumber(event.requiredTickets)}장부터`,
        event.maxTicketsPerUser != null && `1인 최대 ${formatNumber(event.maxTicketsPerUser)}장`,
    ].filter((rule): rule is string => typeof rule === 'string');
    const summary = stats.length > 0 ? stats : rules;

    return (
        <Card size="lg" className="group relative gap-5 p-(--card-spacing)">
            {/* 카드 어디를 눌러도 상세로 — 버튼과 같은 곳이라 낭독기·키보드에서는 감추고 버튼 하나로만 읽힌다 (게임 카드와 같은 방식) */}
            <Link
                to={eventDetailPath(event)}
                aria-hidden
                tabIndex={-1}
                className="absolute inset-0 z-1 rounded-2xl"
            />
            <div className="flex gap-5">
                <div className="flex min-w-0 flex-1 flex-col gap-3">
                    {/*
                     * 사용자가 판단하는 순서로 — ① 얼마나 남았나(타이머) ② 무엇을 주나(제목·그림)
                     * ③ 내가 이미 했나(내 응모 칩) ④ 언제 열리나·설명(보조색) ⑤ 숫자(버튼 옆 작은 한 줄).
                     * 칩은 타이머(검정)와 내 응모(노랑) 둘만 둔다 — 칩이 셋을 넘으면 모두 같은 무게라 아무것도 먼저 읽히지 않았다
                     */}
                    {/* 윗줄 — 왼쪽 끝 타이머, 오른쪽 끝 내 응모. 서로 떨어져 있어 타이머 글자가 바뀌어도 칩이 따라 움직이지 않는다 */}
                    <div className="flex flex-wrap items-center justify-between gap-x-2.5 gap-y-1">
                        <CloseCountdown remainingMs={remainingMs} />
                        <RaffleEntryChip event={event} mySpentTicketCount={mySpentTicketCount} />
                    </div>
                    <div className="flex flex-col gap-1">
                        <p className="text-title-3 text-fg-primary line-clamp-2">{event.title}</p>
                        <p className="text-body-sm text-fg-tertiary tabular-nums">
                            {formatKstTimeRange(event.startsAt, event.endsAt)}
                        </p>
                        {event.description && (
                            <p className="text-body-sm text-fg-secondary line-clamp-2 break-keep">
                                {event.description}
                            </p>
                        )}
                    </div>
                </div>
                {/* 상품 그림은 1:1(DESIGN-SYSTEM '이미지 비율')이되 작게 — 크게 두면 설명이 짧을 때 왼쪽이 텅 빈다 */}
                <EventThumbnail
                    src={event.bannerImageUrl}
                    className="size-24 rounded-xl sm:size-32 [&_img]:transition-transform [&_img]:duration-300 motion-safe:group-hover:[&_img]:scale-105"
                />
            </div>
            {/* 맨 아래 한 줄 — 숫자는 왼쪽에 작게, 응모 버튼은 오른쪽 끝에. 글 길이가 달라도 카드 바닥에 붙는다 */}
            <div className="border-border-default mt-auto flex flex-wrap items-center justify-between gap-4 border-t pt-4">
                <p className="text-body-sm text-fg-tertiary min-w-0 tabular-nums">
                    {summary.join(' · ')}
                </p>
                <Button asChild variant="accent" className="relative z-2 px-5">
                    <Link to={eventDetailPath(event)}>응모하러 가기</Link>
                </Button>
            </div>
        </Card>
    );
}
