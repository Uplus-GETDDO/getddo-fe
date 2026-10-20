import { Clock } from 'lucide-react';
import { Link } from 'react-router-dom';

import type { Event } from '@entities/event';

import { useEntryStatistics } from '@entities/entry';
import { RaffleEntryChip } from '@entities/event';
import { queryPresets } from '@shared/api/queryPresets';
import { useVirtualClock } from '@shared/model/virtualClock';
import { Button } from '@shared/ui/button';
import { KST_HOUR_MINUTE, formatKst } from '@shared/utils/date';
import { formatNumber } from '@shared/utils/format';

import { formatRunningRange } from '../utils/raffleFormat';
import { CloseCountdownChip } from './CloseCountdownChip';
import { RaffleThumbnail } from './RaffleThumbnail';

/** 참여 현황을 다시 받아오는 주기(초) — 폴링 설정과 문구가 따로 놀지 않게 같은 값을 쓴다 */
const REFRESH_SECONDS = queryPresets.realtime.refetchInterval / 1000;

interface LiveRaffleCardProps {
    event: Event;
}

export function LiveRaffleCard({ event }: LiveRaffleCardProps) {
    // 이 카드는 현재 보이는 진행 중 래플 1건이라 이 이벤트의 E03만 폴링한다 (ADR-0007)
    const { data: statistics, dataUpdatedAt } = useEntryStatistics(event.id, { isOpen: true });
    const { override } = useVirtualClock();
    // 참여 현황은 폴링으로 따라가는 값이라 지금 이 순간의 수가 아니다 — 언제 기준인지 시각으로 적는다.
    // updatedAt은 쿼리가 실제 시각으로 적는 값이다. 관리자가 가상 시계로 시간을 멈춰 두면
    // 화면의 다른 시각과 어긋나지 않게 그 시각을 기준으로 적는다.
    // 매초 바뀌는 'n초 전'은 눈에 걸려 분 단위 기준 시각과 갱신 주기만 적는다
    const fetchedAt = dataUpdatedAt ? (override ?? new Date(dataUpdatedAt)) : null;

    // 가운데 소개 칸 아래 현황 — 이름 위·값 아래 큰 숫자로 둬 한눈에 들어오게 한다
    const stats = [
        // 경품 요약은 상세(E02)에만 있다 — 목록만으로 만든 이벤트는 당첨 인원이 없다 (spec EventSummary)
        {
            label: '당첨 인원',
            value: event.winnerCount != null ? `${formatNumber(event.winnerCount)}명` : '-',
        },
        {
            label: '참여 중',
            value: statistics ? `${formatNumber(statistics.participantCount)}명` : '-',
        },
        {
            label: '사용된 응모권',
            value: statistics ? `${formatNumber(statistics.totalSpentTicketCount)}장` : '-',
        },
    ];

    return (
        /*
         * 그림 · 소개 · 응모 칸 세 덩어리. 소개 칸은 위에 래플 소개, 아래에 현황 숫자를 둬 빈 곳 없이 채우고,
         * 응모 칸은 남은 시간·응모 조건·버튼만 둔다 — 버튼은 맨 아래에 붙인다
         */
        <article className="bg-surface-elevated border-border-default grid gap-6 rounded-2xl border p-6 shadow-md lg:grid-cols-[16rem_minmax(0,1fr)_17rem] lg:gap-8">
            <RaffleThumbnail
                src={event.bannerImageUrl}
                className="w-full max-w-64 self-center justify-self-center rounded-xl lg:self-start"
            />

            <div className="flex min-w-0 flex-col gap-3 lg:py-1">
                <div className="text-body-sm flex flex-wrap items-center gap-x-3 gap-y-1">
                    <span className="text-fg-primary flex items-center gap-1.5">
                        <span className="bg-brand-primary size-1.5 rounded-full" />
                        진행중
                    </span>
                    <span className="text-fg-secondary flex items-center gap-1 tabular-nums">
                        <Clock className="size-3.5" />
                        {formatRunningRange(event)}
                    </span>
                    {/* 한도가 남았으면 '응모 중 · 쓴 장수', 다 썼으면 '응모 완료' */}
                    <RaffleEntryChip
                        event={event}
                        mySpentTicketCount={statistics?.mySpentTicketCount}
                    />
                </div>
                <h3 className="text-title-2 text-fg-primary">{event.title}</h3>
                <p className="text-body text-fg-secondary line-clamp-2">{event.description}</p>

                <div className="mt-auto flex flex-col gap-2 pt-3">
                    <dl className="divide-border-default grid grid-cols-3 divide-x">
                        {stats.map(({ label, value }) => (
                            <div key={label} className="flex flex-col gap-1 px-5 first:pl-0">
                                <dt className="text-body-sm text-fg-tertiary">{label}</dt>
                                <dd className="text-title-3 text-fg-primary tabular-nums">
                                    {value}
                                </dd>
                            </div>
                        ))}
                    </dl>
                    {statistics && fetchedAt && (
                        <p className="text-caption text-fg-tertiary">
                            {formatKst(fetchedAt, KST_HOUR_MINUTE)} 기준 · {REFRESH_SECONDS}초마다
                            갱신돼요
                        </p>
                    )}
                </div>
            </div>

            <div className="border-border-default flex flex-col gap-5 border-t pt-6 lg:border-t-0 lg:border-l lg:pt-1 lg:pl-8">
                <div className="flex flex-col gap-1">
                    <span className="text-caption text-fg-tertiary">마감까지</span>
                    <CloseCountdownChip endsAt={event.endsAt} size="lg" />
                </div>
                <EntryConditions
                    event={event}
                    mySpentTicketCount={statistics?.mySpentTicketCount}
                />
                <Button asChild variant="accent" size="lg" className="mt-auto w-full">
                    <Link to={`/time-raffle/${event.id}`}>응모하러 가기</Link>
                </Button>
            </div>
        </article>
    );
}

/** 응모 칸의 응모 조건 — 무엇으로 몇 장까지 낼 수 있는지, 내가 이미 냈는지 */
function EntryConditions({
    event,
    mySpentTicketCount,
}: {
    event: Event;
    /** 내가 쓴 응모권 — E03의 정확한 값만 쓴다. 회차 × 장수로 어림하면 여러 장 응모를 적게 센다 */
    mySpentTicketCount: number | undefined;
}) {
    const rows = [
        { label: '응모 방식', value: entryMethodLabel(event) },
        // 상한 실값은 상세(E02)에만 있다 — 목록만으로 만든 가중치 이벤트는 undefined라 행을 뺀다
        event.eventType === 'TICKET' &&
            event.maxTicketsPerUser !== undefined && {
                label: '1인 최대',
                value:
                    event.maxTicketsPerUser === null
                        ? '제한 없음'
                        : `${formatNumber(event.maxTicketsPerUser)}장`,
            },
        mySpentTicketCount != null &&
            mySpentTicketCount > 0 && {
                label: '내 응모',
                value: `${formatNumber(mySpentTicketCount)}장`,
            },
    ].filter((row) => row !== false);

    return (
        <dl className="flex flex-col gap-2">
            {rows.map(({ label, value }) => (
                <div key={label} className="flex items-center justify-between gap-3">
                    <dt className="text-body-sm text-fg-tertiary">{label}</dt>
                    <dd className="text-body-sm-bold text-fg-primary">{value}</dd>
                </div>
            ))}
        </dl>
    );
}

/** 응모권을 어떻게 내는지 — 소비자 화면이라 '가중치' 대신 '등급별 추첨 반영'이라 적는다 */
function entryMethodLabel(event: Event): string {
    if (event.eventType === 'NO_TICKET') return '응모권 없이';
    if (event.weightingEnabled) return '등급별 추첨 반영';
    return `브론즈 ${formatNumber(event.requiredTickets)}장`;
}
