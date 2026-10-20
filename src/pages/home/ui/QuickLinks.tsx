import { Link } from 'react-router-dom';

import { useAttendanceToday } from '@entities/attendance';
import { useGameList } from '@entities/game';
import { useMissionList } from '@entities/mission';
import { TICKET_GRADE_IMAGE, useMyTickets } from '@entities/ticket';
import { hasGamePlayer } from '@features/playGame';
import stepAttendance from '@shared/assets/step/step-attendance.png';
import stepGame from '@shared/assets/step/step-game.png';
import stepMission from '@shared/assets/step/step-mission.png';
import { formatNumber } from '@shared/utils/format';

interface QuickLink {
    to: string;
    label: string;
    image: string;
    /** 오늘 할 게 남았는가 — 그림 모서리에 작은 점을 찍는다 */
    pending?: boolean;
    /** 버튼 옆 짧은 숫자 — 게임 남은 보상, 응모권 보유 장수 */
    count?: string;
}

/**
 * 홈 바로가기 — 출석·퀴즈/설문·게임·내 응모권 내역을 그림 버튼 한 줄로. 그림은 미션 페이지 단계 아이콘과 같은 것을 쓴다. 할 일이 남은 곳엔 점만 찍어 단순하게 둔다.
 * 게임은 응모권 목록에 섞여 찾기 어렵다는 의견에 따라 노란 바탕으로 가장 먼저 눈에 띄게 한다
 */
export function QuickLinks() {
    const { data: attendance } = useAttendanceToday();
    const { data: missions } = useMissionList();
    const { data: games } = useGameList();
    const { data: tickets } = useMyTickets();

    // 플레이 화면이 있는 게임만 센다 — 후보·준비 중 게임은 홈 어디에도 두지 않는다
    const playable = games?.filter((game) => hasGamePlayer(game.id));
    const gamesLeft = playable?.filter((game) => game.remainingPlays > 0).length ?? 0;

    const game: QuickLink = {
        to: '/missions#today-games',
        label: '게임하러 가기',
        image: stepGame,
        count: gamesLeft > 0 ? `보상 ${gamesLeft}개 남음` : undefined,
    };
    const links: QuickLink[] = [
        {
            to: '/missions#today-attendance',
            label: '출석 체크',
            image: stepAttendance,
            pending: attendance ? !attendance.attended : false,
        },
        {
            to: '/missions#today-missions',
            label: '퀴즈·설문',
            image: stepMission,
            pending: missions?.some((mission) => !mission.completed) ?? false,
        },
        {
            to: '/my-tickets',
            label: '내 응모권 내역',
            image: TICKET_GRADE_IMAGE.BRONZE,
            count: tickets ? `${formatNumber(tickets.availableCount)}장` : undefined,
        },
    ];

    return (
        // 좁은 화면에서는 줄을 바꾸지 않고 옆으로 밀어 본다. 그림자가 잘리지 않게 여백을 두고 같은 만큼 당긴다
        <nav
            aria-label="바로가기"
            className="-m-2 flex [scrollbar-width:none] items-center gap-2 overflow-x-auto p-2 [&::-webkit-scrollbar]:hidden"
        >
            {/* 게임 — 진한 노랑 바탕·조금 더 큰 버튼으로 가장 먼저 */}
            <Link
                to={game.to}
                className="bg-ticket-primary text-ticket-on focus-visible:ring-border-focus inline-flex h-12 shrink-0 items-center gap-2 rounded-xl px-4 shadow-md transition-[filter,transform] hover:brightness-95 focus-visible:ring-2 focus-visible:outline-none active:translate-y-px"
            >
                <img src={game.image} alt="" aria-hidden className="size-6 object-contain" />
                <span className="text-body-bold">{game.label}</span>
                {game.count && (
                    <span className="bg-surface-page text-caption rounded-full px-2 py-0.5 tabular-nums">
                        {game.count}
                    </span>
                )}
            </Link>
            {links.map(({ to, label, image, pending, count }) => (
                <Link
                    key={to}
                    to={to}
                    className="bg-surface-page border-border-default hover:bg-surface-canvas focus-visible:ring-border-focus inline-flex h-12 shrink-0 items-center gap-2 rounded-xl border px-3.5 shadow-md transition-[background-color,transform] focus-visible:ring-2 focus-visible:outline-none active:translate-y-px"
                >
                    <span className="relative shrink-0">
                        <img src={image} alt="" aria-hidden className="size-6 object-contain" />
                        {/* 오늘 할 게 남았다는 표시 — 글자 대신 점 하나 */}
                        {pending && (
                            <span className="bg-brand-primary border-surface-page absolute -top-0.5 -right-0.5 size-2.5 rounded-full border-2">
                                <span className="sr-only">오늘 할 일이 남았어요</span>
                            </span>
                        )}
                    </span>
                    <span className="text-body-sm-bold text-fg-primary">{label}</span>
                    {count && (
                        <span className="text-caption text-fg-tertiary tabular-nums">{count}</span>
                    )}
                </Link>
            ))}
        </nav>
    );
}
