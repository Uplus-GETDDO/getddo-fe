import type { MissionSummary } from '../model/types';

import { MISSION_THUMBNAILS } from '../model/missionThumbnails';

/**
 * 미션 썸네일 — 서버 그림이 있으면 그것을, 없으면 종류별 기본 그림.
 * 목록 응답(M01)에는 문항 종류가 없어 OX 퀴즈는 제목의 'OX'로 가린다 — 계약에 문항 종류가 생기면 그 값으로 바꾼다
 */
export function missionThumbnail(
    mission: Pick<MissionSummary, 'imageUrl' | 'missionType' | 'title'>,
): string {
    if (mission.imageUrl) return mission.imageUrl;
    if (mission.missionType === 'SURVEY') return MISSION_THUMBNAILS.SURVEY;
    return /\bOX\b/i.test(mission.title) ? MISSION_THUMBNAILS.OX : MISSION_THUMBNAILS.QUIZ;
}
