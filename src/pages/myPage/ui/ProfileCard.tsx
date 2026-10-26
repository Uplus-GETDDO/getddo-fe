import type { ReactNode } from 'react';

import { ChevronRight, Repeat } from 'lucide-react';
import { Link } from 'react-router-dom';

import type { VirtualUser } from '@entities/user';

import { MEMBERSHIP_LABEL } from '@entities/event';
import {
    TICKET_GRADES,
    TicketGradePill,
    TicketBalanceStatus,
    type useMyTickets,
} from '@entities/ticket';
import { virtualUserLabel } from '@entities/user';
import { VirtualUserSwitcher } from '@features/switchVirtualUser';
import profileAvatar from '@shared/assets/ui/profile-avatar.png';
import { Badge } from '@shared/ui/badge';
import { Button } from '@shared/ui/button';
import { RefreshStatus } from '@shared/ui/refresh-status';
import { SkeletonText } from '@shared/ui/skeleton';
import { TICKET_OUTLINE_FILTER } from '@shared/ui/ticket-card';
import { formatNumber } from '@shared/utils/format';

export interface ProfileStats {
    /** 응모 중 — 발표를 기다리는 접수 건 */
    pendingCount: number;
    wonCount: number;
    /** 가장 최근 당첨 응모의 날짜 표기 (없으면 null) */
    lastWonLabel: string | null;
    /** 오늘 받은 응모권 장수 */
    todayGranted: number | undefined;
    historiesError?: boolean;
    historiesFetching?: boolean;
    onRetryHistories?: () => void;
    /** 응모 내역(응모 중·당첨)을 불러오는 중 — 0건으로 잘못 보이지 않게 글줄 스켈레톤을 둔다 */
    entriesLoading: boolean;
    /** 응모 내역(E06) 자체가 실패해 건수를 알 수 없는 상태 — 일부 결과 미조회와 구분한다 */
    entriesFailed?: boolean;
    entriesUnavailable?: boolean;
    /** 응모권 내역(오늘 적립)을 불러오는 중 */
    historiesLoading: boolean;
}

/** 칸 값·설명 자리 — 불러오는 동안 다른 화면과 같은 둥근 글줄로 둔다 */
const VALUE_SKELETON = <SkeletonText className="h-7 w-16" />;
const CAPTION_SKELETON = <SkeletonText className="w-32" />;

const TILE =
    'focus-visible:ring-border-focus relative flex min-h-30 flex-col gap-1 rounded-xl p-4 transition-colors focus-visible:ring-2 focus-visible:outline-none';

/** 응모권 칸 좌우의 반원 구멍(반지름 10) — 칸 세로 가운데를 도려낸다 */
const TICKET_PUNCH =
    '[mask-image:radial-gradient(circle_10px_at_left_50%,transparent_98%,black_100%),radial-gradient(circle_10px_at_right_50%,transparent_98%,black_100%)] [mask-composite:intersect]';

/**
 * 요약 칸 하나 — 누르면 해당 내역으로 간다.
 * 네 칸 모두 좌우에 구멍을 뚫은 응모권 모양이다. 구멍을 따라 윤곽선이 돌도록
 * 바탕·테두리는 뒤쪽 층(drop-shadow 윤곽)에 두고, 초점 테두리가 잘리지 않게 링크 자체에는 마스크를 걸지 않는다
 */
function StatTile({
    to,
    label,
    value,
    children,
}: {
    to: string;
    label: string;
    value: ReactNode;
    children: React.ReactNode;
}) {
    return (
        <Link to={to} className={`${TILE} group isolate`}>
            <span
                aria-hidden
                className="absolute inset-0 -z-10"
                style={{ filter: TICKET_OUTLINE_FILTER }}
            >
                <span
                    className={`bg-surface-page group-hover:bg-surface-canvas block size-full rounded-xl transition-colors ${TICKET_PUNCH}`}
                />
            </span>
            <span className="text-body-sm text-fg-secondary">{label}</span>
            <span className="text-title-2 text-fg-primary">{value}</span>
            <ChevronRight aria-hidden className="text-fg-primary absolute top-4 right-4 size-4" />
            <span className="mt-auto">{children}</span>
        </Link>
    );
}

/**
 * 마이페이지 머리 — 프로필(아바타·이름·멤버십) + 요약 칸 4개(응모권·응모 중·당첨·오늘 적립).
 * 요약 칸은 각자의 상세로 이어지는 입구다: 응모권 → /my-tickets, 응모 중·당첨 → /my-entries(결과 필터), 오늘 적립 → /missions
 */
export function ProfileCard({
    user,
    ticketsQuery,
    stats,
}: {
    user: VirtualUser;
    ticketsQuery: ReturnType<typeof useMyTickets>;
    stats: ProfileStats;
}) {
    const tickets = ticketsQuery.data;
    return (
        <section className="bg-surface-page border-border-default flex flex-col gap-6 rounded-2xl border p-6 shadow-md">
            <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <img src={profileAvatar} alt="" className="size-12.5 shrink-0 rounded-full" />
                    <div className="flex flex-col">
                        <div className="flex items-center gap-2">
                            <h1 className="text-body-bold text-fg-primary">{user.name}</h1>
                            {user.role === 'ADMIN' ? (
                                <Badge variant="brand" size="sm">
                                    관리자
                                </Badge>
                            ) : (
                                <Badge size="sm">{MEMBERSHIP_LABEL[user.membership]}</Badge>
                            )}
                        </div>
                        <span className="text-body-sm text-fg-tertiary">
                            {virtualUserLabel(user)}
                        </span>
                    </div>
                </div>
                <VirtualUserSwitcher
                    trigger={
                        <Button variant="secondary" size="sm">
                            <Repeat className="size-4" />
                            계정 전환
                        </Button>
                    }
                />
            </div>

            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <StatTile
                    to="/my-tickets"
                    label="응모권"
                    value={
                        tickets
                            ? `${formatNumber(tickets.availableCount)}장`
                            : ticketsQuery.isPending
                              ? VALUE_SKELETON
                              : '조회 실패'
                    }
                >
                    {tickets && (
                        <span className="flex flex-wrap gap-1">
                            {TICKET_GRADES.map((grade) => (
                                <TicketGradePill
                                    key={grade}
                                    grade={grade}
                                    count={tickets.countByGrade[grade]}
                                    unit="장"
                                />
                            ))}
                        </span>
                    )}
                </StatTile>
                <StatTile
                    to="/my-entries?status=PENDING"
                    label="응모 중"
                    value={
                        stats.entriesLoading
                            ? VALUE_SKELETON
                            : stats.entriesFailed
                              ? '조회 실패'
                              : stats.entriesUnavailable
                                ? '일부 결과 미조회'
                                : `${formatNumber(stats.pendingCount)}건`
                    }
                >
                    {stats.entriesLoading ? (
                        CAPTION_SKELETON
                    ) : (
                        <span className="text-caption text-fg-tertiary">
                            {stats.entriesFailed
                                ? '응모 내역을 불러오지 못했어요'
                                : stats.entriesUnavailable
                                  ? '마지막 조회 기준이에요'
                                  : stats.pendingCount > 0
                                    ? '결과 발표를 기다리고 있어요'
                                    : '발표를 기다리는 응모가 없어요'}
                        </span>
                    )}
                </StatTile>
                <StatTile
                    to="/my-entries?status=WON"
                    label="당첨"
                    value={
                        stats.entriesLoading
                            ? VALUE_SKELETON
                            : stats.entriesFailed
                              ? '조회 실패'
                              : stats.entriesUnavailable
                                ? '일부 결과 미조회'
                                : `${formatNumber(stats.wonCount)}건`
                    }
                >
                    {stats.entriesLoading ? (
                        CAPTION_SKELETON
                    ) : (
                        <span className="text-caption text-fg-tertiary">
                            {stats.entriesFailed
                                ? '응모 내역을 불러오지 못했어요'
                                : stats.entriesUnavailable
                                  ? '마지막 조회 기준이에요'
                                  : stats.lastWonLabel
                                    ? `최근 당첨 ${stats.lastWonLabel}`
                                    : '아직 당첨이 없어요'}
                        </span>
                    )}
                </StatTile>
                <StatTile
                    to="/missions"
                    label="오늘 적립"
                    value={
                        stats.historiesLoading
                            ? VALUE_SKELETON
                            : stats.todayGranted === undefined
                              ? '조회 실패'
                              : `+${formatNumber(stats.todayGranted)}장`
                    }
                >
                    <span className="text-caption text-fg-tertiary">
                        출석·게임·미션으로 더 받을 수 있어요
                    </span>
                </StatTile>
            </div>
            {/* 받아 둔 합계가 있으면 다시 받기 실패에도 그 값을 두고 안내를 띄우지 않는다 */}
            {stats.historiesError && stats.todayGranted === undefined && (
                // '오늘 적립' 칸은 '조회 실패'로 남기고, 여기엔 다시 받는 작은 표시만 둔다 — 큰 안내 줄이 카드를 밀어냈다
                <RefreshStatus
                    fetching={stats.historiesFetching ?? false}
                    error
                    onRefresh={() => stats.onRetryHistories?.()}
                    className="self-start"
                />
            )}
            <TicketBalanceStatus query={ticketsQuery} />
        </section>
    );
}
