import { useEffect, useState } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';

import { useAttendanceToday } from '@entities/attendance';
import { type TicketGrade, TicketRewardDialog } from '@entities/ticket';
import { AttendanceCheckCard } from '@features/checkAttendance';
import { RefreshStatus } from '@shared/ui/refresh-status';
import { cn } from '@shared/utils/cn';
import { GameRail } from '@widgets/gameRail';

import { MISSION_SECTION_IDS } from './model/sectionIds';
import { MissionBoard } from './ui/MissionBoard';
import { MissionDialog } from './ui/MissionDialog';
import { SectionHeader } from './ui/SectionHeader';
import { TicketHistoryCard } from './ui/TicketHistoryCard';
import { TodayRewardsBanner } from './ui/TodayRewardsBanner';

const CONTAINER = 'mx-auto w-full max-w-312 px-6';

/** 미션 풀이 모달을 바로 열 때 쓰는 주소 값 — /missions?mission=<id> */
const MISSION_PARAM = 'mission';
/** 위쪽 카드가 불러와져 자리가 밀린 뒤 다시 맞추는 시점 */
const SETTLE_SCROLL_MS = 600;

export function MissionListPage() {
    // 초기화는 늘 자정이라 날짜·시각·시간대 없이 짧게 적는다 — 'KST'·'00:00'은 사용자에게 낯선 표기였다
    const attendanceResetCaption = '하루 1회 · 매일 자정 초기화';
    const attendanceQuery = useAttendanceToday();
    // 출석 카드를 펼치면(펼쳐보기·출석 완료) 출석 카드가 넓어지고 응모권 내역 카드가 좁아진다.
    // 펼침 상태는 저장하지 않는다 — 페이지에 들어올 때마다 접힌 상태로 새로 시작한다
    const [attendanceExpanded, setAttendanceExpanded] = useState(false);

    // 설문·퀴즈 풀이 모달로 연 미션, 완료 직후 보상 모달에 보여줄 응모권 수
    // 홈 카드처럼 다른 화면에서 ?mission=<id>로 들어오면 그 미션 풀이 모달을 바로 연다
    const [searchParams, setSearchParams] = useSearchParams();
    const [openMissionId, setOpenMissionIdState] = useState<string | null>(() =>
        searchParams.get(MISSION_PARAM),
    );
    // 다른 화면에서 들어올 때 뒤 배경도 그 자리로 내려 둔다 — #섹션이 있으면 그 섹션, 미션 모달로 들어오면 미션 섹션.
    // 모달을 닫았을 때 페이지 맨 위가 아니라 방금 고른 카드가 있는 자리가 보인다
    const { hash } = useLocation();
    // 들어온 순간의 목적지만 쓴다 — 모달을 닫으며 주소를 지워도 다시 스크롤하지 않는다
    const [scrollTarget] = useState(() =>
        hash
            ? hash.slice(1)
            : searchParams.has(MISSION_PARAM)
              ? MISSION_SECTION_IDS.missions
              : null,
    );
    useEffect(() => {
        if (!scrollTarget) return;
        const scroll = () =>
            document.getElementById(scrollTarget)?.scrollIntoView({ block: 'start' });
        // 레이아웃의 스크롤 복원이 맨 위로 올린 뒤에 한 번, 위쪽 출석·게임 카드가 불러와져 높이가 늘어난 뒤에 한 번 더 맞춘다
        const frame = requestAnimationFrame(scroll);
        const settle = setTimeout(scroll, SETTLE_SCROLL_MS);
        return () => {
            cancelAnimationFrame(frame);
            clearTimeout(settle);
        };
    }, [scrollTarget]);
    const setOpenMissionId = (id: string | null) => {
        setOpenMissionIdState(id);
        // 닫으면 주소의 미션 표시도 지워 새로고침했을 때 다시 열리지 않게 한다
        if (id === null && searchParams.has(MISSION_PARAM)) {
            setSearchParams({}, { replace: true });
        }
    };
    // 응모권 수는 닫히는 동안에도 남겨 두어야 닫힘 애니메이션에서 0장으로 바뀌지 않는다
    const [reward, setReward] = useState<{
        open: boolean;
        tickets: number;
        grade: TicketGrade | null;
    }>({ open: false, tickets: 0, grade: null });

    return (
        <main className="flex flex-col pb-28">
            <div className={CONTAINER}>
                {/* 페이지 머리 — 오늘의 적립: 오늘 더 받을 응모권·진행 세 칸과 내 응모권 지갑 */}
                <TodayRewardsBanner />

                {/*
                 * 넓은 화면에서는 두 칸의 제목 줄·카드를 같은 행(subgrid)에 둔다 — 출석판을 펼쳐 오른쪽 칸이 좁아지면
                 * 내역 제목 줄(갱신 표시·전체보기)이 두 줄로 접히는데, 그래도 두 카드의 윗선이 어긋나지 않는다
                 */}
                <div
                    className={cn(
                        'mt-14 grid gap-x-4 gap-y-10 lg:gap-y-6',
                        attendanceExpanded
                            ? 'lg:grid-cols-[885fr_300fr]'
                            : 'lg:grid-cols-[393fr_791fr]',
                    )}
                >
                    <section
                        id={MISSION_SECTION_IDS.attendance}
                        className="flex min-w-0 scroll-mt-24 flex-col gap-6 lg:row-span-2 lg:grid lg:grid-rows-subgrid"
                    >
                        <SectionHeader
                            title="출석체크"
                            caption={attendanceResetCaption}
                            // 받아 둔 출석 정보가 있는데 다시 받기에 실패했을 때만 — 카드와 같은 조회라 요청은 한 번이다
                            refresh={
                                attendanceQuery.isError &&
                                attendanceQuery.data && (
                                    <RefreshStatus
                                        fetching={attendanceQuery.isFetching}
                                        error
                                        errorLabel="출석 정보 갱신 실패"
                                        // 출석 칸 제목 줄이 좁아 글자까지 두면 줄이 넘어가 아래가 밀렸다 — 빨간 경고 아이콘만, 글은 툴팁·화면 낭독기로
                                        labelClassName="sr-only"
                                        onRefresh={() => void attendanceQuery.refetch()}
                                    />
                                )
                            }
                        />
                        <AttendanceCheckCard
                            expanded={attendanceExpanded}
                            onExpandedChange={setAttendanceExpanded}
                        />
                    </section>
                    <section className="flex min-w-0 flex-col gap-6 lg:row-span-2 lg:grid lg:grid-rows-subgrid">
                        {/* 제목 줄(갱신 표시 포함)도 카드가 그린다 — 같은 조회의 받는 중·실패를 제목 옆에 보인다 */}
                        <TicketHistoryCard className="flex-1" narrow={attendanceExpanded} />
                    </section>
                </div>
            </div>

            {/* 게임 섹션 — 홈과 같이 배경 띠 없이 다른 섹션과 같은 간격(80). 카드 목록은 콘텐츠 폭(최대 1200px) 안에서 넘긴다 */}
            <div id={MISSION_SECTION_IDS.games} className={`${CONTAINER} mt-20 scroll-mt-24`}>
                <GameRail
                    title="게임"
                    fill
                    caption="게임마다 하루 한 번 응모권을 받을 수 있어요. 매일 자정 초기화"
                />
            </div>

            {/* 설문·퀴즈 */}
            <MissionBoard
                id={MISSION_SECTION_IDS.missions}
                className={`${CONTAINER} mt-20`}
                onOpen={setOpenMissionId}
            />

            <MissionDialog
                missionId={openMissionId}
                onClose={() => setOpenMissionId(null)}
                onRewarded={(tickets, grade) => {
                    // 풀이 모달을 닫고 보상 모달을 띄운다
                    setOpenMissionId(null);
                    setReward({ open: true, tickets, grade });
                }}
            />
            {/* 설문·퀴즈도 등급 응모권(브론즈~플래티넘)이 나와 게임과 같은 캡슐 뽑기 모달을 쓴다 — 겟또타임 바로가기도 모달 안에 있다 */}
            <TicketRewardDialog
                open={reward.open}
                onOpenChange={(open) => setReward((prev) => ({ ...prev, open }))}
                tickets={reward.tickets}
                grade={reward.grade}
                source="미션"
            />
        </main>
    );
}
