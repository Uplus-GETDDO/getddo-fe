import type { LucideIcon } from 'lucide-react';

import { CalendarCheck, ChevronRight, ClipboardList, Gamepad2, Ticket } from 'lucide-react';
import { Link } from 'react-router-dom';

import type { Game } from '@entities/game';

import { ATTENDANCE_THUMBNAIL, useAttendanceToday } from '@entities/attendance';
import {
    GameTicketCard,
    gameDetailPath,
    useGameList,
    getGameContent,
    useGameStatisticsList,
} from '@entities/game';
import { missionThumbnail, useMissionList } from '@entities/mission';
import { useSessionStore } from '@entities/user';
import { hasGamePlayer } from '@features/playGame';
import { useDragScroll } from '@shared/hooks/useDragScroll';
import { Button } from '@shared/ui/button';
import { LoadError } from '@shared/ui/load-error';
import { SkeletonCard } from '@shared/ui/skeleton';
import { TicketCard, TicketCardMedia } from '@shared/ui/ticket-card';
import { cn } from '@shared/utils/cn';

import type { OrderableEarnCard } from '../utils/orderEarnCards';

import { orderEarnCards } from '../utils/orderEarnCards';

interface EarnCard extends OrderableEarnCard {
    id: string;
    title: string;
    description: string;
    /** 스텁에 적는 보상 단위 — 출석은 브론즈 고정, 미션·게임은 지급 시 확률 추첨의 등급 응모권 (getddo-spec ticket.md) */
    rewardKind: string;
    href: string;
    actionLabel: string;
    /** 카드 상단 썸네일 — 이미지가 있으면 보여주고(출석·미션·게임), 없으면 회색 블록 + 아이콘 */
    thumbnailUrl: string | null;
    thumbnailIcon: LucideIcon;
    /** 게임 카드면 미션 페이지와 같은 공용 게임 카드(GameTicketCard)로 그린다 */
    game?: Game;
}

/**
 * railClassName: 카드 가로 스크롤 영역에 덧붙일 클래스 (예: 화면 끝까지 펼치기)
 * cardClassName: 카드에 덧붙일 클래스 (예: 고정 너비) — 넘기지 않으면 기존 모양 그대로다
 * hideMoreLink: 제목 옆 '더보기' 링크를 숨긴다 (미션 페이지처럼 이미 전체 목록인 곳)
 */
export function TicketBalanceWidget({
    railClassName,
    cardClassName,
    hideMoreLink = false,
}: {
    railClassName?: string;
    cardClassName?: string;
    hideMoreLink?: boolean;
} = {}) {
    const attendanceQuery = useAttendanceToday();
    const missionsQuery = useMissionList();
    const gamesQuery = useGameList();
    const { data: attendance, isPending: attendancePending } = attendanceQuery;
    const { data: missions, isPending: missionsPending } = missionsQuery;
    const { data: games, isPending: gamesPending } = gamesQuery;
    const anyError = attendanceQuery.isError || missionsQuery.isError || gamesQuery.isError;
    const retryAll = () => {
        if (attendanceQuery.isError) void attendanceQuery.refetch();
        if (missionsQuery.isError) void missionsQuery.refetch();
        if (gamesQuery.isError) void gamesQuery.refetch();
    };
    const isUser = useSessionStore((state) => state.user?.role === 'USER');
    const statistics = useGameStatisticsList(
        (games ?? []).filter((game) => hasGamePlayer(game.code)).map((game) => game.id),
        isUser,
    );
    const claimed = (id: string) =>
        statistics.find((query) => query.data?.gameId === id)?.data?.rewardClaimedToday;
    // 셋이 모두 올 때까지 카드 자리만 잡아 둔다 — 비어 있다가 갑자기 섹션이 생기면 아래 내용이 밀리고,
    // 하나씩 도착할 때마다 그리면 순서(orderEarnCards)가 바뀌며 카드가 뒤섞여 보인다
    const statisticsPending = isUser && statistics.some((query) => query.isPending);
    const loading = attendancePending || missionsPending || gamesPending || statisticsPending;
    // 마우스 드래그 + 관성 스크롤은 공용 훅을 쓴다 (터치는 브라우저 네이티브 스크롤)
    const dragScroll = useDragScroll<HTMLDivElement>();

    const cards: EarnCard[] = [
        ...(attendance
            ? [
                  {
                      id: 'attendance',
                      category: 'ATTENDANCE' as const,
                      title: '오늘 출석 체크',
                      description: '하루 한 번, 누르면 바로 받아요',
                      rewardKind: '브론즈 응모권',
                      rewardTickets: attendance.dailyRewardTicketCount,
                      // 미션 페이지의 출석 섹션으로 바로 내려간다 (missionList MISSION_SECTION_IDS.attendance)
                      href: '/missions#today-attendance',
                      actionLabel: '출석하러 가기',
                      completed: attendance.attended,
                      thumbnailUrl: ATTENDANCE_THUMBNAIL,
                      thumbnailIcon: CalendarCheck,
                  },
              ]
            : []),
        ...(missions ?? []).map((mission) => ({
            id: mission.id,
            category: 'MISSION' as const,
            title: mission.title,
            description: '미션 완료 시 등급 추첨 응모권을 받아요',
            rewardKind: '등급 응모권',
            rewardTickets: mission.rewardTicketCount,
            // 미션 페이지에서 그 미션의 풀이 모달을 바로 연다
            href: `/missions?mission=${mission.id}`,
            actionLabel: '미션하러 가기',
            completed: mission.completed,
            thumbnailUrl: missionThumbnail(mission),
            thumbnailIcon: ClipboardList,
        })),
        ...(games ?? [])
            .filter((game) => hasGamePlayer(game.code))
            .map((game) => ({
                id: game.id,
                category: 'GAME' as const,
                title: game.name,
                description: '게임별 최소 점수로 완료하면 하루 1장, 횟수 제한 없이 플레이',
                rewardKind: '등급 응모권',
                rewardTickets: 1,
                href: gameDetailPath(game.id),
                actionLabel: '게임하러 가기',
                completed: claimed(game.id) ?? false,
                thumbnailUrl: getGameContent(game).heroImage,
                thumbnailIcon: Gamepad2,
                game,
            })),
    ];
    const orderedCards = orderEarnCards(cards);

    // 받을 수 있는 게 정말 없을 때만 섹션을 감춘다 — 못 불러온 것이면 자리를 지키고 다시 시도를 연다
    if (cards.length === 0 && !loading && !anyError) {
        return null;
    }

    return (
        <section className="flex flex-col gap-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-3">
                    <h2 className="text-title-3 text-fg-primary">오늘 받을 수 있는 응모권</h2>
                    <span className="text-fg-tertiary text-caption">
                        출석과 게임 보상은 매일 자정에 다시 받을 수 있어요.
                    </span>
                </div>
                {!hideMoreLink && (
                    <Button asChild variant="link" size="text">
                        <Link to="/missions">
                            더보기
                            <ChevronRight />
                        </Link>
                    </Button>
                )}
            </div>
            {/* 한 화면에 N.5장 — 반 장이 잘려 보이며 옆으로 더 있다는 암시를 준다. 마우스는 드래그로, 터치는 브라우저 네이티브 스크롤로 움직인다 */}
            {cards.length === 0 && !loading && anyError ? (
                <LoadError
                    title="받을 수 있는 응모권을 불러오지 못했어요"
                    onRetry={retryAll}
                    inline
                />
            ) : loading ? (
                <div role="status" className="flex gap-4 overflow-hidden">
                    <span className="sr-only">응모권 카드를 불러오는 중이에요</span>
                    {Array.from({ length: 4 }, (_, index) => (
                        <SkeletonCard key={index} className="h-90 w-66.25 shrink-0" />
                    ))}
                </div>
            ) : (
                <div
                    {...dragScroll}
                    className={cn(
                        // 카드 그림자가 잘리지 않게 사방에 12px 여백을 두고 같은 만큼 당긴다
                        '-m-3 flex cursor-grab scroll-px-3 [scrollbar-width:none] gap-4 overflow-x-auto p-3 select-none active:cursor-grabbing [&::-webkit-scrollbar]:hidden',
                        railClassName,
                    )}
                >
                    {orderedCards.map((card) => (
                        // 자리 이동 애니메이션은 두지 않는다 — 새로고침 때 출석·미션·게임이 따로 불러와지며 순서가 바뀌어 카드가 미끄러져 보였다
                        <div
                            key={card.id}
                            className={cn(
                                // 게임 페이지 티켓 카드와 같은 크기 (너비 265, 높이 360)
                                'flex w-66.25 shrink-0',
                                cardClassName,
                            )}
                        >
                            {card.game ? (
                                // 미션 페이지 게임 목록과 같은 카드 — 카드 어디를 눌러도 게임으로 들어가고, 준비 중인 게임은 막는다
                                <GameTicketCard
                                    game={card.game}
                                    rewardedToday={claimed(card.game.id)}
                                    href={card.href}
                                    ready={hasGamePlayer(card.game.code)}
                                    className="w-full"
                                />
                            ) : (
                                <EarnTicketCard card={card} />
                            )}
                        </div>
                    ))}
                </div>
            )}
        </section>
    );
}

/**
 * 출석·미션 티켓 카드 — 게임 카드(GameTicketCard)와 같은 꼴로, 카드 어디를 눌러도 들어간다.
 * 홈의 검정 버튼은 '응모하러 가기'에만 쓰므로 출석도 secondary다 (DESIGN-SYSTEM 13절 — primary는 행동 묶음마다 하나)
 */
function EarnTicketCard({ card }: { card: EarnCard }) {
    return (
        // 공용 티켓 카드 — 펀칭은 절취선 높이에 맞춰 실제로 도려낸다 (피그마 Group 633903)
        <TicketCard
            className="w-full"
            cardClassName="relative h-90"
            stub={
                <>
                    <div className="mt-3.75 flex h-4.5 items-center justify-between gap-2">
                        <span className="text-fg-tertiary text-caption">{card.rewardKind}</span>
                        <span className="text-fg-primary text-body-sm-bold flex items-center gap-1">
                            <Ticket className="size-4.5" />+{card.rewardTickets}
                        </span>
                    </div>
                    {card.completed ? (
                        <Button disabled size="lg" className="mt-2 w-full">
                            오늘 참여 완료
                        </Button>
                    ) : (
                        // 카드 전체를 덮는 링크(아래) 위에 버튼을 올린다
                        <Button
                            asChild
                            variant="secondary"
                            size="lg"
                            className="relative z-2 mt-2 w-full"
                        >
                            <Link to={card.href}>{card.actionLabel}</Link>
                        </Button>
                    )}
                </>
            }
        >
            {/* 카드 전체를 덮는 링크 — 버튼과 같은 곳이라 낭독기·키보드에서는 감추고 버튼 하나로만 읽힌다 */}
            {!card.completed && (
                <Link
                    to={card.href}
                    aria-hidden
                    tabIndex={-1}
                    className="absolute inset-0 z-1 rounded-2xl"
                />
            )}
            {/* 미션 그림(16:9, 바탕 투명)은 바탕 없이 카드 위에 바로 얹는다 — 그림이 없을 때만 회색 칸 + 아이콘 */}
            <TicketCardMedia
                src={card.thumbnailUrl}
                fit="contain"
                fallback={<card.thumbnailIcon className="text-fg-disabled size-8" />}
            />
            <div className="mt-3 flex flex-col gap-2">
                <div className="flex flex-col">
                    <span className="text-fg-tertiary text-caption">{card.category}</span>
                    <p className="text-body-bold text-fg-primary truncate">{card.title}</p>
                </div>
                <p className="text-fg-tertiary text-body-sm line-clamp-2">{card.description}</p>
            </div>
        </TicketCard>
    );
}
