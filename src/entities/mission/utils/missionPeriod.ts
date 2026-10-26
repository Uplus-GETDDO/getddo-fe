/** 지금 참여할 수 있는 미션인지 — 운영 기간 [startsAt, endsAt) 안이면 true. 목록(M01)에는 지난·예정 미션도 섞여 온다 */
export const isMissionOpen = (mission: { startsAt: string; endsAt: string }, now: Date) =>
    new Date(mission.startsAt) <= now && now < new Date(mission.endsAt);

/**
 * 응답의 serverTime 기준으로 지금 참여할 수 있는 미션인지 — M01은 끝난·예정 미션도 섞여 오고
 * status를 주지 않아 항목의 serverTime으로 판정한다 (브라우저 시계가 아니라 서버 시각 기준, 종료 정각부터 마감)
 */
export const isMissionOpenByServerTime = (mission: {
    startsAt: string;
    endsAt: string;
    serverTime: string;
}) => isMissionOpen(mission, new Date(mission.serverTime));
