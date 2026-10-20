/**
 * 오늘 받을 수 있는 응모권 진행 — 출석(하루 1번), 게임(게임마다 하루 1번), 설문·퀴즈(미션마다 1번).
 * 아직 불러오지 못한 항목은 undefined로 두고 남은 수 계산에서 뺀다
 */
export interface TodayRewardProgress {
    attendance: { done: boolean } | undefined;
    games: { done: number; total: number } | undefined;
    missions: { done: number; total: number } | undefined;
    /** 오늘 더 받을 수 있는 보상 수 */
    remaining: number;
}

export function summarizeTodayRewards({
    attended,
    games,
    missions,
}: {
    attended: boolean | undefined;
    /** 플레이할 수 있는 게임만 넘긴다 (준비 중인 게임은 받을 수 없다) */
    games: { rewardedToday?: boolean }[] | undefined;
    missions: { completed: boolean }[] | undefined;
}): TodayRewardProgress {
    const attendance = attended === undefined ? undefined : { done: attended };
    const gameProgress = games && {
        done: games.filter((game) => game.rewardedToday).length,
        total: games.length,
    };
    const missionProgress = missions && {
        done: missions.filter((mission) => mission.completed).length,
        total: missions.length,
    };
    const remaining =
        (attendance && !attendance.done ? 1 : 0) +
        (gameProgress ? gameProgress.total - gameProgress.done : 0) +
        (missionProgress ? missionProgress.total - missionProgress.done : 0);
    return { attendance, games: gameProgress, missions: missionProgress, remaining };
}
