import { useEffect, useState } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';

import { MissionRewardDialog } from '@entities/mission';
import { TICKET_GRADE_LABEL, type TicketGrade, TicketGradeReveal } from '@entities/ticket';
import { AttendanceCheckCard } from '@features/checkAttendance';
import { Button } from '@shared/ui/button';
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

                <div
                    className={cn(
                        'mt-14 grid gap-x-4 gap-y-10',
                        attendanceExpanded
                            ? 'lg:grid-cols-[885fr_300fr]'
                            : 'lg:grid-cols-[393fr_791fr]',
                    )}
                >
                    <section
                        id={MISSION_SECTION_IDS.attendance}
                        className="flex min-w-0 scroll-mt-24 flex-col gap-6"
                    >
                        <SectionHeader title="출석체크" caption={attendanceResetCaption} />
                        <AttendanceCheckCard
                            expanded={attendanceExpanded}
                            onExpandedChange={setAttendanceExpanded}
                        />
                    </section>
                    <section className="flex min-w-0 flex-col gap-6">
                        {/* 제목 줄(갱신 표시 포함)도 카드가 그린다 — 같은 조회의 받는 중·실패를 제목 옆에 보인다 */}
                        <TicketHistoryCard className="flex-1" />
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
            <MissionRewardDialog
                open={reward.open}
                onOpenChange={(open) => setReward((prev) => ({ ...prev, open }))}
                tickets={reward.tickets}
                // 받은 등급을 응모권 카드가 뒤집히며 보여 준다 (게임 보상 모달과 같은 연출)
                gradeLabel={reward.grade ? TICKET_GRADE_LABEL[reward.grade] : undefined}
                reveal={reward.grade ? <TicketGradeReveal grade={reward.grade} /> : undefined}
                // 받은 응모권을 바로 쓰러 가는 길 — 보상 모달의 끝을 겟또타임으로 이어 준다
                action={
                    <Button asChild className="w-full">
                        <Link to="/time-raffle">응모하러 가기</Link>
                    </Button>
                }
            />
        </main>
    );
}
