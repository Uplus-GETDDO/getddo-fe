/** 지금 참여할 수 있는 미션인지 — 운영 기간 [startsAt, endsAt) 안이면 true. 목록(M01)에는 지난·예정 미션도 섞여 온다 */
export const isMissionOpen = (mission: { startsAt: string; endsAt: string }, now: Date) =>
    new Date(mission.startsAt) <= now && now < new Date(mission.endsAt);
