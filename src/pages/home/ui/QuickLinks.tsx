import { Check } from 'lucide-react';
import { Link } from 'react-router-dom';

import { useAttendanceToday } from '@entities/attendance';
import { useGameList } from '@entities/game';
import { isMissionOpen, useMissionList } from '@entities/mission';
import { hasGamePlayer } from '@features/playGame';
import stepAttendance from '@shared/assets/step/step-attendance.png';
import stepGame from '@shared/assets/step/step-game.png';
import stepMission from '@shared/assets/step/step-mission.png';
import { useVirtualClock } from '@shared/model/virtualClock';

/** 오늘 이 바로가기의 할 일 — 남음(점)·다 함(체크)·아직 모름(받기 전) */
type Today = 'pending' | 'done' | 'unknown';

interface QuickLink {
    to: string;
    label: string;
    /** 오늘 할 일을 다 했을 때의 이름 */
    doneLabel: string;
    image: string;
    today: Today;
    /** 할 일이 남았을 때 노란 바탕으로 가장 먼저 눈에 띄게 한다 (게임) */
    highlight?: boolean;
}

const todayOf = (known: boolean, pending: boolean): Today =>
    !known ? 'unknown' : pending ? 'pending' : 'done';

/**
 * 홈 바로가기 — 응모권을 모으는 출석·퀴즈/설문·게임 세 곳. 그림은 미션 페이지 단계 아이콘과 같은 것을 쓴다.
 * 할 일이 남은 곳엔 점, 다 한 곳은 체크와 흐린 글자로 바꿔 '오늘 더 할 게 있는지'가 한눈에 보이게 한다.
 * 할 일이 남은 곳을 앞으로 모은다. 게임은 응모권 목록에 섞여 찾기 어렵다는 의견에 따라 남아 있을 때 노란 바탕으로 띄운다.
 * 응모권 내역은 '모으기'가 아니라 '확인하기'라 빼고 마이페이지·헤더 쪽에 둔다.
 * 숫자(남은 개수·보유 장수)는 들어간 화면에서 보여주고 여기엔 두지 않는다
 */
export function QuickLinks() {
    const { data: attendance } = useAttendanceToday();
    const { data: missions } = useMissionList();
    const { data: games } = useGameList();
    const now = useVirtualClock().now();

    // 플레이 화면이 있는 게임만 센다 — 후보·준비 중 게임은 홈 어디에도 두지 않는다
    const playable = games?.filter((game) => hasGamePlayer(game.id));

    const links: QuickLink[] = [
        {
            to: '/missions#today-games',
            label: '게임하러 가기',
            doneLabel: '게임 보상 완료',
            image: stepGame,
            today: todayOf(!!playable, playable?.some((game) => game.remainingPlays > 0) ?? false),
            highlight: true,
        },
        {
            to: '/missions#today-attendance',
            label: '출석 체크',
            doneLabel: '출석 완료',
            image: stepAttendance,
            today: todayOf(!!attendance, attendance ? !attendance.attended : false),
        },
        {
            to: '/missions#today-missions',
            label: '퀴즈·설문',
            doneLabel: '퀴즈·설문 완료',
            image: stepMission,
            // 지금 열린 미션만 센다 — 목록에는 지난·예정 미션도 있어, 열린 걸 다 해도 지난 미션 때문에 점이 남았다 (미션 배너와 같은 기준)
            today: todayOf(
                !!missions,
                missions?.some((mission) => !mission.completed && isMissionOpen(mission, now)) ??
                    false,
            ),
        },
    ];
    // 다 한 곳은 뒤로 — 같은 상태끼리는 위 순서(게임 → 출석 → 퀴즈·설문)를 지킨다
    const ordered = [...links].sort(
        (a, b) => Number(a.today === 'done') - Number(b.today === 'done'),
    );

    return (
        // 좁은 화면은 세 칸에 나눠 그림 위·이름 아래로, 넓은 화면은 한 줄 버튼으로 둔다. 그림자가 잘리지 않게 여백을 두고 같은 만큼 당긴다
        <nav
            aria-label="바로가기"
            className="-m-2 grid grid-cols-3 gap-2 p-2 sm:flex sm:items-center"
        >
            {ordered.map((link) => (
                <QuickLinkButton key={link.to} link={link} />
            ))}
        </nav>
    );
}

function QuickLinkButton({ link }: { link: QuickLink }) {
    const done = link.today === 'done';
    const highlight = link.highlight && link.today === 'pending';
    // 그림자 없이 공용 버튼과 같은 호버·누름 — 노랑은 accent 버튼처럼 밝기를, 흰 칸은 secondary 버튼처럼 바탕·테두리를 한 단계 바꾼다.
    // 배너 아래 작은 버튼 셋이 모두 떠 보이면 무거웠다
    const tone = highlight
        ? 'bg-ticket-primary text-ticket-on border-transparent hover:brightness-95 active:brightness-90'
        : done
          ? 'bg-surface-sunken text-fg-tertiary border-transparent hover:bg-surface-canvas active:bg-surface-pressed'
          : 'bg-surface-page text-fg-primary border-border-default hover:bg-surface-canvas hover:border-border-strong active:bg-surface-pressed';
    return (
        <Link
            to={link.to}
            className={`${tone} group focus-visible:ring-border-focus flex min-w-0 flex-col items-center justify-center gap-1 rounded-lg border px-2 py-2.5 text-center transition-[background-color,border-color,filter] focus-visible:ring-2 focus-visible:outline-none sm:h-12 sm:shrink-0 sm:flex-row sm:gap-2 sm:px-4 sm:py-0`}
        >
            <span className="relative shrink-0">
                <img
                    src={link.image}
                    alt=""
                    aria-hidden
                    className={`size-6 object-contain ${done ? 'opacity-50 grayscale' : ''}`}
                />
                {link.today === 'pending' && (
                    // 오늘 할 일이 남았다는 표시 — 글자 대신 점 하나
                    // 점 테두리는 버튼 바탕색과 같게 — 그림을 살짝 파낸 것처럼 보이게 한다 (노란 게임 칸에 흰 테두리가 튀었다)
                    <span
                        className={`bg-brand-primary absolute -top-0.5 -right-0.5 size-2.5 rounded-full border-2 ${highlight ? 'border-ticket-primary' : 'border-surface-page group-hover:border-surface-canvas group-active:border-surface-pressed'}`}
                    >
                        <span className="sr-only">오늘 할 일이 남았어요</span>
                    </span>
                )}
            </span>
            <span className="text-body-sm-bold flex items-center gap-1">
                {done ? link.doneLabel : link.label}
                {done && <Check aria-hidden className="size-4" />}
            </span>
        </Link>
    );
}
