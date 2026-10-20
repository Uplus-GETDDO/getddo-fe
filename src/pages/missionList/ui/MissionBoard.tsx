import { useEffect, useState } from 'react';

import { useMissionList } from '@entities/mission';
import emptyMascot from '@shared/assets/ui/reward-mascot.png';
import { useVirtualClock } from '@shared/model/virtualClock';
import { ChipTabs, chipTabIds } from '@shared/ui/chip-tabs';
import { LoadError } from '@shared/ui/load-error';
import { SkeletonCard } from '@shared/ui/skeleton';

import {
    filterMissions,
    MISSION_FILTERS,
    type MissionFilter,
    sortMissions,
} from '../utils/missionBoard';
import { MissionCard } from './MissionCard';
import { SectionHeader } from './SectionHeader';

/** 카드 상태(곧 시작·참여 가능·기간 종료)를 다시 판정하는 간격 — 오늘의 적립 배너와 같이 1분 */
const NOW_REFRESH_MS = 60_000;

/**
 * 설문·퀴즈 섹션 — 종류·참여 완료 거르기(공용 ChipTabs, 이벤트 목록과 같은 탭), 참여 가능한 미션부터 놓은 카드 목록.
 * 카드마다 보상 칩을 노랗게 두면 모두 같은 강조라 아무것도 눈에 띄지 않아(멘토링: 중요한 곳에만 악센트 색),
 * 보상은 요약 줄의 진한 글자로 둔다. 이 화면의 노랑은 위 출석 버튼 한 곳이다.
 * 완료 진행은 위 "오늘의 적립" 배너 한 곳에서만 보여 준다 (게임 섹션과 통일).
 * 미션이 없으면 타꼬가 다음 미션을 알려 준다
 */
export function MissionBoard({
    id,
    className,
    onOpen,
}: {
    id: string;
    className?: string;
    onOpen: (missionId: string) => void;
}) {
    const missionsQuery = useMissionList();
    const { data: missions, isPending } = missionsQuery;
    // 가상 시계는 시간이 흘러도 다시 그리지 않으므로, 페이지를 열어 둔 채 시작·마감 시각을 지나도
    // 카드가 바뀌도록 1분마다 다시 그려 지금 시각을 새로 읽는다. 시간 여행은 시계 context가 바뀌어 바로 반영된다
    const [, setTick] = useState(0);
    useEffect(() => {
        const timer = setInterval(() => setTick((tick) => tick + 1), NOW_REFRESH_MS);
        return () => clearInterval(timer);
    }, []);
    const now = useVirtualClock().now();
    const [filter, setFilter] = useState<MissionFilter>('ALL');

    const shown = missions ? sortMissions(filterMissions(missions, filter), now) : [];
    const { panelId, tabId } = chipTabIds('missions', filter);

    return (
        <section id={id} className={`flex scroll-mt-24 flex-col gap-6 ${className ?? ''}`}>
            <SectionHeader
                title="설문 · 퀴즈"
                caption="미션마다 한 번만 응모권을 받을 수 있어요."
            />

            {missions && missions.length > 0 && (
                // 이벤트 목록과 같은 공용 칩 탭 — 좌우 방향키로 옮기고, 아래 목록이 탭 패널이다
                <ChipTabs
                    tabs={MISSION_FILTERS}
                    value={filter}
                    onValueChange={setFilter}
                    label="미션 거르기"
                    idPrefix="missions"
                />
            )}

            <div
                id={panelId}
                role="tabpanel"
                aria-labelledby={tabId}
                className="flex flex-col gap-6"
            >
                {isPending && (
                    <div aria-hidden className="grid gap-4 md:grid-cols-2">
                        {Array.from({ length: 4 }, (_, index) => (
                            <SkeletonCard key={index} className="h-28" />
                        ))}
                    </div>
                )}
                {/* 받아 둔 목록이 없을 때만 — 받아 둔 게 있으면 다시 받기에 실패해도 그대로 둔다 */}
                {!isPending && !missions && (
                    <LoadError
                        title="미션을 불러오지 못했어요"
                        onRetry={() => void missionsQuery.refetch()}
                        retrying={missionsQuery.isFetching}
                        className="bg-surface-sunken rounded-2xl"
                    />
                )}

                {missions && shown.length === 0 && (
                    <div className="bg-surface-sunken flex flex-col items-center gap-3 rounded-2xl px-6 py-10 text-center">
                        <img src={emptyMascot} alt="" className="h-24 w-auto" />
                        <p className="text-body-bold text-fg-primary">
                            {missions.length === 0
                                ? '새 미션이 곧 올라와요'
                                : filter === 'DONE'
                                  ? '아직 참여한 미션이 없어요'
                                  : '이 종류의 미션이 아직 없어요'}
                        </p>
                        <p className="text-body-sm text-fg-tertiary">
                            {missions.length === 0
                                ? '그동안 출석하고 게임하면서 응모권을 모아 두세요.'
                                : '다른 미션부터 참여해 보세요.'}
                        </p>
                    </div>
                )}

                {shown.length > 0 && (
                    // 설문·퀴즈 카드는 넓은 화면에서 2열로 둔다
                    <div className="grid gap-4 md:grid-cols-2">
                        {shown.map((mission) => (
                            <MissionCard
                                key={mission.id}
                                mission={mission}
                                now={now}
                                onOpen={onOpen}
                            />
                        ))}
                    </div>
                )}
            </div>
        </section>
    );
}
