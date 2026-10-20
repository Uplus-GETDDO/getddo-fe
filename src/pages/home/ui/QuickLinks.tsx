import { Link } from 'react-router-dom';

import { useAttendanceToday } from '@entities/attendance';
import { useGameList } from '@entities/game';
import { useMissionList } from '@entities/mission';
import { TICKET_GRADE_IMAGE } from '@entities/ticket';
import { hasGamePlayer } from '@features/playGame';
import stepAttendance from '@shared/assets/step/step-attendance.png';
import stepGame from '@shared/assets/step/step-game.png';
import stepMission from '@shared/assets/step/step-mission.png';

interface QuickLink {
    to: string;
    label: string;
    image: string;
    /** 오늘 할 게 남았는가 — 그림 모서리에 작은 점을 찍는다 */
    pending?: boolean;
}

/**
 * 홈 바로가기 — 출석·퀴즈/설문·게임·내 응모권 내역을 그림 버튼 한 줄로. 그림은 미션 페이지 단계 아이콘과 같은 것을 쓴다. 할 일이 남은 곳엔 점만 찍어 단순하게 둔다 — 남은 개수·보유 장수는 들어간 화면에서 보여주고 여기엔 숫자를 두지 않는다.
 * 게임은 응모권 목록에 섞여 찾기 어렵다는 의견에 따라 노란 바탕으로 가장 먼저 눈에 띄게 한다
 */
export function QuickLinks() {
    const { data: attendance } = useAttendanceToday();
    const { data: missions } = useMissionList();
    const { data: games } = useGameList();

    // 플레이 화면이 있는 게임만 센다 — 후보·준비 중 게임은 홈 어디에도 두지 않는다
    const playable = games?.filter((game) => hasGamePlayer(game.id));
    const gamesLeft = playable?.some((game) => game.remainingPlays > 0) ?? false;

    const game: QuickLink = {
        to: '/missions#today-games',
        label: '게임하러 가기',
        image: stepGame,
        pending: gamesLeft,
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
                <QuickLinkIcon image={game.image} pending={game.pending} />
                <span className="text-body-bold">{game.label}</span>
            </Link>
            {links.map(({ to, label, image, pending }) => (
                <Link
                    key={to}
                    to={to}
                    className="bg-surface-page border-border-default hover:bg-surface-canvas focus-visible:ring-border-focus inline-flex h-12 shrink-0 items-center gap-2 rounded-xl border px-3.5 shadow-md transition-[background-color,transform] focus-visible:ring-2 focus-visible:outline-none active:translate-y-px"
                >
                    <QuickLinkIcon image={image} pending={pending} />
                    <span className="text-body-sm-bold text-fg-primary">{label}</span>
                </Link>
            ))}
        </nav>
    );
}

/** 바로가기 그림 — 오늘 할 게 남았으면 모서리에 브랜드색 점 하나 (글자 대신) */
function QuickLinkIcon({ image, pending }: { image: string; pending?: boolean }) {
    return (
        <span className="relative shrink-0">
            <img src={image} alt="" aria-hidden className="size-6 object-contain" />
            {pending && (
                <span className="bg-brand-primary border-surface-page absolute -top-0.5 -right-0.5 size-2.5 rounded-full border-2">
                    <span className="sr-only">오늘 할 일이 남았어요</span>
                </span>
            )}
        </span>
    );
}
