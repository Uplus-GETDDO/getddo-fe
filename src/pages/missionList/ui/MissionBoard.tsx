import { useEffect, useState } from 'react';

import { useMissionList } from '@entities/mission';
import emptyMascot from '@shared/assets/ui/reward-mascot.png';
import { useVirtualClock } from '@shared/model/virtualClock';
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
 * 설문·퀴즈 섹션 — 종류·참여 완료 거르기 칩, 참여 가능한 미션부터 놓은 카드 목록.
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

    return (
        <section id={id} className={`flex scroll-mt-24 flex-col gap-6 ${className ?? ''}`}>
            <SectionHeader
                title="설문 · 퀴즈"
                caption="미션마다 한 번만 응모권을 받을 수 있어요."
            />

            {missions && missions.length > 0 && (
                // 이벤트 목록의 거르기 칩과 같은 모양 — 고른 칩은 검정 테두리 (마젠타는 "지금" 신호에만, DESIGN-SYSTEM 색 역할 규칙). 고르지 않은 칩은 마우스를 올리면 테두리·글자가 진해지고 바탕이 옅은 회색이 된다
                <div className="flex flex-wrap items-center gap-2">
                    {MISSION_FILTERS.map((item) => (
                        <button
                            key={item.value}
                            type="button"
                            aria-pressed={item.value === filter}
                            onClick={() => setFilter(item.value)}
                            className={`bg-surface-page text-caption focus-visible:ring-border-focus focus-visible:ring-offset-surface-page cursor-pointer rounded-full border px-3 py-1 transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none ${item.value === filter ? 'border-fg-primary text-fg-primary' : 'border-border-strong text-fg-tertiary hover:border-fg-tertiary hover:bg-surface-canvas hover:text-fg-primary active:bg-surface-sunken'}`}
                        >
                            {item.label}
                        </button>
                    ))}
                </div>
            )}

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
                        <MissionCard key={mission.id} mission={mission} now={now} onOpen={onOpen} />
                    ))}
                </div>
            )}
        </section>
    );
}
