import { useEffect, useState } from 'react';

import { useAttendanceToday } from '@entities/attendance';
import { useGameList, useGameStatisticsList } from '@entities/game';
import { isMissionOpenByServerTime, useLatestMissions } from '@entities/mission';
import { useSessionStore } from '@entities/user';
import { hasGamePlayer } from '@features/playGame';
import shopCounter from '@shared/assets/shop/shop-counter.jpg';
import shopWall from '@shared/assets/shop/shop-wall.jpg';
import stepAttendance from '@shared/assets/step/step-attendance.png';
import stepGame from '@shared/assets/step/step-game.png';
import stepMission from '@shared/assets/step/step-mission.png';
import { useVirtualClock } from '@shared/model/virtualClock';
import { SkeletonText } from '@shared/ui/skeleton';
import { StepTile } from '@shared/ui/step-tile';
import { TicketWallet } from '@widgets/ticketWallet';

import itemCup from '../assets/item-cup.png';
import itemFlag from '../assets/item-flag.png';
import itemJar from '../assets/item-jar.png';
import itemMayo from '../assets/item-mayo.png';
import itemSauce from '../assets/item-sauce.png';
import itemSkewer from '../assets/item-skewer.png';
import { useSlotNumber } from '../hooks/useSlotNumber';
import { MISSION_SECTION_IDS } from '../model/sectionIds';
import { summarizeTodayRewards } from '../utils/todayRewards';

/** 기준 시각을 다시 읽는 간격 */
const NOW_REFRESH_MS = 60_000;

const DATE_FORMAT = new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul',
    month: 'long',
    day: 'numeric',
    weekday: 'long',
});

/** 진행 점은 이 개수까지만 그린다 — 넘으면 숫자만 둔다 */
const MAX_PROGRESS_DOTS = 8;

/** 숫자 옆 점(●●○)으로 진행을 보여 준다 — 다 끝났으면 노란 점 */
function ProgressDots({
    count,
    done,
}: {
    count: { done: number; total: number } | undefined;
    done: boolean;
}) {
    if (!count || count.total === 0 || count.total > MAX_PROGRESS_DOTS) return null;
    return (
        <span aria-hidden className="flex shrink-0 gap-1">
            {Array.from({ length: count.total }, (_, index) => (
                <span
                    key={index}
                    className={`size-1.5 rounded-full ${index >= count.done ? 'bg-border-strong' : done ? 'bg-ticket-primary' : 'bg-fg-primary'}`}
                />
            ))}
        </span>
    );
}

/**
 * 미션 페이지 머리 — "오늘의 적립".
 * 왼쪽: 오늘 날짜와 오늘 더 받을 수 있는 응모권 수, 출석·게임·설문퀴즈 진행 세 칸(누르면 해당 섹션으로)
 * 오른쪽: 내 응모권 지갑(widgets/ticketWallet) — 바로가기는 응모권 내역
 */
/** 칸 값을 불러오기 전 자리 — '-' 대신 다른 화면과 같은 둥근 글줄 */
const VALUE_PLACEHOLDER = <SkeletonText className="h-4 w-14" />;

export function TodayRewardsBanner() {
    const { data: today } = useAttendanceToday();
    const { data: games, isError: gamesError } = useGameList();
    const isUser = useSessionStore((state) => state.user?.role === 'USER');
    const playableGames = games?.filter((game) => hasGamePlayer(game.code));
    const statistics = useGameStatisticsList(
        (playableGames ?? []).map((game) => game.id),
        isUser,
    );
    const gameRewardsError = isUser && (gamesError || statistics.some((item) => item.isError));
    const gameRewards = !isUser
        ? []
        : playableGames && statistics.every((item) => item.isSuccess)
          ? statistics.map((item) => ({ rewardedToday: item.data?.rewardClaimedToday }))
          : undefined;
    const { data: missions } = useLatestMissions();
    // 날짜·이번 달·진행 중 미션 판정 기준 시각 — 페이지를 열어 둔 채 기준일이 바뀌어도
    // 출석 상태(주기적으로 다시 받는다)와 같은 날을 보도록 1분마다 다시 읽는다
    const clock = useVirtualClock();
    const [now, setNow] = useState(() => clock.now());
    useEffect(() => {
        const timer = setInterval(() => setNow(clock.now()), NOW_REFRESH_MS);
        return () => clearInterval(timer);
    }, [clock]);

    const progress = summarizeTodayRewards({
        attended: today?.attended,
        // 준비 중인 게임은 보상을 받을 수 없어 세지 않는다
        games: gameRewards,
        // 지금 참여할 수 있는 미션만 센다 — 판정은 응답의 serverTime 기준이다 (완료 여부는 그대로 반영)
        missions: missions?.filter((mission) => isMissionOpenByServerTime(mission)),
    });
    // 출석·게임·미션을 다 불러오기 전에는 남은 장수가 0으로 잡혀 틀린 숫자가 보이니 글줄 스켈레톤으로 둔다
    const ready =
        progress.attendance !== undefined &&
        progress.games !== undefined &&
        progress.missions !== undefined;
    const allDone = ready && progress.attendance?.done === true && progress.remaining === 0;
    // 오늘 더 받을 장수는 슬롯처럼 무작위 숫자가 잠깐 돌다가 멈춘다 — 작은 수를 세어 올리면 너무 빨리 끝나 어색하다
    const remaining = useSlotNumber(progress.remaining);
    const isComplete = (count: { done: number; total: number } | undefined) =>
        !!count && count.total > 0 && count.done === count.total;
    const attendanceDone = progress.attendance?.done === true;
    const gamesDone = isComplete(progress.games);
    const missionsDone = isComplete(progress.missions);

    return (
        <section
            aria-labelledby="today-rewards-title"
            // 타코야끼 가게 — 벽(피그마 image 197 벽 부분)을 배경으로 깔고 아래에 카운터 띠(image 211)를 둔다. --counter는 카운터 띠 높이
            className="force-light bg-play-yellow-soft relative overflow-hidden rounded-3xl bg-cover bg-top [--counter:clamp(4.5rem,8vw,6rem)]"
            style={{ backgroundImage: `url(${shopWall})` }}
        >
            {/* 벽 그림이 어두운 웜톤이라 흰 막을 얇게 덮어 페이지 바탕과 어울리게 밝힌다 */}
            <div aria-hidden className="bg-surface-page/45 absolute inset-0" />
            {/* 카운터 띠(image 211) — 이음매 없이 이어지도록 자른 타일·상판·나무를 가로로 반복한다 */}
            <div
                aria-hidden
                className="absolute inset-x-0 bottom-0 h-(--counter) bg-size-[auto_100%] bg-left bg-repeat-x"
                style={{ backgroundImage: `url(${shopCounter})` }}
            />
            {/* 카운터 위 소품(image 105 소스병, image 106 꼬치) — 왼쪽 끝 소스·마요·잼병, 오른쪽 끝 꼬치·이쑤시개 통·깃발.
                가장 큰 깃발도 카운터 띠 높이의 1.5배 안에 들어와, 내용 아래 여백(--counter의 1.5배)에 가려지지 않는다 */}
            <div
                aria-hidden
                className="pointer-events-none absolute inset-x-3 bottom-[calc(var(--counter)*0.6)] flex items-end justify-between md:inset-x-5"
            >
                <div className="flex items-end gap-1">
                    <img src={itemSauce} alt="" className="h-[calc(var(--counter)*0.7)] w-auto" />
                    <img src={itemMayo} alt="" className="h-[calc(var(--counter)*0.7)] w-auto" />
                    <img
                        src={itemJar}
                        alt=""
                        className="hidden h-[calc(var(--counter)*0.5)] w-auto sm:block"
                    />
                </div>
                <div className="flex items-end gap-1">
                    <img
                        src={itemSkewer}
                        alt=""
                        className="hidden h-[calc(var(--counter)*0.75)] w-auto sm:block"
                    />
                    <img src={itemCup} alt="" className="h-[calc(var(--counter)*0.5)] w-auto" />
                    <img src={itemFlag} alt="" className="h-[calc(var(--counter)*0.95)] w-auto" />
                </div>
            </div>

            {/* 왼쪽 진행 칸과 오른쪽 지갑의 아래 끝을 맞춘다 — 가운데 맞춤이면 높이 차이만큼 5px 어긋났다 */}
            <div className="relative grid items-end gap-8 p-6 pb-[calc(var(--counter)*1.5+0.5rem)] md:p-10 md:pb-[calc(var(--counter)*1.5+0.5rem)] lg:grid-cols-[1fr_22rem]">
                <div className="flex min-w-0 flex-col">
                    <p className="text-body-sm-bold text-fg-secondary">
                        {DATE_FORMAT.format(now)} · 오늘의 적립
                    </p>
                    <h1
                        id="today-rewards-title"
                        className="text-title-1 text-fg-primary mt-2 break-keep"
                    >
                        {gameRewardsError ? (
                            <span role="status">오늘의 게임 보상을 불러오지 못했어요</span>
                        ) : allDone ? (
                            '오늘 받을 응모권을 다 모았어요!'
                        ) : (
                            <>
                                오늘 응모권{' '}
                                <span className="text-display text-fg-primary tabular-nums">
                                    {ready ? (
                                        remaining
                                    ) : (
                                        <SkeletonText className="h-[0.8em] w-12" />
                                    )}
                                    장
                                </span>{' '}
                                더 받을 수 있어요
                            </>
                        )}
                    </h1>
                    <p className="text-body text-fg-secondary mt-2 break-keep">
                        {allDone
                            ? '내일 또 출석하고 게임하러 와요.'
                            : '출석하고, 게임하고, 퀴즈를 풀면 응모권이 쌓여요.'}
                    </p>

                    {/* 좁은 화면에서도 세 칸을 가로로 둔다 — 세로로 쌓으면 머리가 화면을 다 차지한다 */}
                    <div className="mt-6 grid grid-cols-3 gap-2 sm:gap-3">
                        <StepTile
                            icon={stepAttendance}
                            // 타코야끼는 그림 안 여백이 적어 다른 두 아이콘보다 커 보여 조금 줄인다
                            iconScale="scale-[0.82]"
                            label="출석체크"
                            value={
                                progress.attendance
                                    ? progress.attendance.done
                                        ? '완료'
                                        : '출석하기'
                                    : VALUE_PLACEHOLDER
                            }
                            done={attendanceDone}
                            targetId={MISSION_SECTION_IDS.attendance}
                        />
                        <StepTile
                            icon={stepGame}
                            label="게임 보상"
                            value={
                                gameRewardsError
                                    ? '조회 실패'
                                    : progress.games
                                      ? `${progress.games.done} / ${progress.games.total}`
                                      : VALUE_PLACEHOLDER
                            }
                            valueSuffix={<ProgressDots count={progress.games} done={gamesDone} />}
                            done={gamesDone}
                            targetId={MISSION_SECTION_IDS.games}
                        />
                        <StepTile
                            icon={stepMission}
                            label="설문 · 퀴즈"
                            value={
                                progress.missions
                                    ? `${progress.missions.done} / ${progress.missions.total}`
                                    : VALUE_PLACEHOLDER
                            }
                            valueSuffix={
                                <ProgressDots count={progress.missions} done={missionsDone} />
                            }
                            done={missionsDone}
                            targetId={MISSION_SECTION_IDS.missions}
                        />
                    </div>
                </div>

                <TicketWallet now={now} action={{ to: '/my-tickets', label: '내역' }} />
            </div>
        </section>
    );
}
