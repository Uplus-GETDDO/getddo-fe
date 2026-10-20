import { GameTicketCard, gameDetailPath, useGameList, useGameStatisticsList } from '@entities/game';
import { useSessionStore } from '@entities/user';
import { hasGamePlayer } from '@features/playGame';
import { useDragScroll } from '@shared/hooks/useDragScroll';
import { LoadError } from '@shared/ui/load-error';
import { SkeletonCard } from '@shared/ui/skeleton';

/** fill일 때 한 줄에 채우는 칸 수 */
const FILL_COLUMNS = 4;

/**
 * 게임 티켓 카드 가로 목록 섹션 — 게임별 하루 1회 응모권 1장. 오늘 보상을 이미 받은 게임은 뒤로 보낸다.
 * 카드 목록은 왼쪽은 콘텐츠 시작선에서 자르고 오른쪽만 화면 끝까지 열어 넘긴다 (--rail-inset은 놓이는 페이지가 정한다)
 */
export function GameRail({
    title,
    caption,
    excludeGameId,
    fill = false,
}: {
    title: string;
    caption?: string;
    /** 목록에서 뺄 게임 — 게임 상세의 '다른 게임'에서 지금 보고 있는 게임을 뺀다 */
    excludeGameId?: string;
    /** 넓은 화면에서 게임이 한 줄(4개)에 다 들어가면 가로 넘김 대신 칸을 꽉 채운다 — 오른쪽이 비어 보였다 */
    fill?: boolean;
}) {
    const gamesQuery = useGameList();
    const { data: games, isPending } = gamesQuery;
    const isUser = useSessionStore((state) => state.user?.role === 'USER');
    const statistics = useGameStatisticsList(
        (games ?? []).filter((game) => hasGamePlayer(game.code)).map((game) => game.id),
        isUser,
    );
    const claimed = (id: string) =>
        statistics.find((item) => item.data?.gameId === id)?.data?.rewardClaimedToday;
    const dragScroll = useDragScroll<HTMLDivElement>();
    const ordered = (games ?? [])
        .filter((game) => game.id !== excludeGameId && hasGamePlayer(game.code))
        // 화면 정리의 후보 게임 제외와 실서버의 당일 보상 정렬을 함께 유지한다.
        .sort((a, b) => Number(claimed(a.id) ?? false) - Number(claimed(b.id) ?? false));
    const fillRow = fill && ordered.length > 0 && ordered.length <= FILL_COLUMNS;

    return (
        <section className="flex flex-col gap-6">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <h2 className="text-title-3 text-fg-primary">{title}</h2>
                {caption && <p className="text-body-sm text-fg-tertiary">{caption}</p>}
            </div>
            {/* 불러오는 동안 게임 카드 자리를 잡아 둔다 */}
            {isPending && (
                <div aria-hidden className="flex gap-4 overflow-hidden">
                    {Array.from({ length: 4 }, (_, index) => (
                        <SkeletonCard key={index} className="h-90 w-66.25 shrink-0" />
                    ))}
                </div>
            )}
            {/* 받아 둔 목록이 없을 때만 — 카드 한 줄 높이를 지켜 아래가 올라오지 않게 한다 */}
            {!isPending && !games && (
                <LoadError
                    title="게임을 불러오지 못했어요"
                    onRetry={() => void gamesQuery.refetch()}
                    retrying={gamesQuery.isFetching}
                    className="min-h-90"
                />
            )}
            {games && ordered.length === 0 && (
                <p className="text-body-sm text-fg-tertiary">지금 참여할 수 있는 게임이 없어요.</p>
            )}
            {fillRow && (
                // 넓은 화면 — 네 칸에 나눠 꽉 채운다. 좁은 화면은 아래 가로 넘김을 그대로 쓴다
                <div className="hidden gap-4 lg:grid lg:grid-cols-4">
                    {ordered.map((game) => (
                        <GameTicketCard
                            key={game.id}
                            game={game}
                            rewardedToday={claimed(game.id)}
                            href={gameDetailPath(game.id)}
                            ready={hasGamePlayer(game.code)}
                            fluid
                        />
                    ))}
                </div>
            )}
            {ordered.length > 0 && (
                // 호버로 떠오르는 카드와 카드 그림자가 잘리지 않게 위아래·좌우 여백을 두고 같은 만큼 당긴다
                <div
                    {...dragScroll}
                    className={`${fillRow ? 'lg:hidden' : ''} -mx-3 -my-3 -mr-[calc(var(--rail-inset,0px)+0.75rem)] flex cursor-grab scroll-px-3 [scrollbar-width:none] gap-4 overflow-x-auto px-3 py-3 pr-[calc(var(--rail-inset,0px)+0.75rem)] select-none active:cursor-grabbing [&::-webkit-scrollbar]:hidden`}
                >
                    {ordered.map((game) => (
                        <div key={game.id} className="shrink-0">
                            <GameTicketCard
                                game={game}
                                rewardedToday={claimed(game.id)}
                                href={gameDetailPath(game.id)}
                                ready={hasGamePlayer(game.code)}
                            />
                        </div>
                    ))}
                </div>
            )}
        </section>
    );
}
