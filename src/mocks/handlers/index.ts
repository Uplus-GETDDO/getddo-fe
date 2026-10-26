import { abuseHandlers } from './abuse';
import { adminEntryHandlers } from './adminEntry';
import { adminEventHandlers } from './adminEvent';
import { adminMissionHandlers } from './adminMission';
import { adminNotificationHandlers } from './adminNotification';
import { adminStatsHandlers } from './adminStats';
import { adminTicketHandlers } from './adminTicket';
import { adminUserHandlers } from './adminUser';
import { attendanceHandlers } from './attendance';
import { bannerHandlers } from './banner';
import { drawHandlers } from './draw';
import { drawResultHandlers } from './drawResult';
import { entryHandlers } from './entry';
import { eventHandlers } from './event';
import { gameHandlers } from './game';
import { missionHandlers } from './mission';
import { notificationHandlers } from './notification';
import { ticketHandlers } from './ticket';
import { virtualUserHandlers } from './virtualUsers';

/*
 * 로컬 개발·테스트 전용 전체 목업 — 배포 빌드는 VITE_ENABLE_MSW=false라
 * 브라우저 목업이 시작되지 않고 모든 요청이 실서버로 간다.
 *
 * AM01~AM03(미션 관리)·AP01/AP03(출석 정책)은 각각 adminMission.ts·attendance.ts에
 * 목업이 있다 — 사용자 목록과 같은 mockMissions 시드를 관리자 계약으로 변환해 낸다.
 *
 * 아직 목업이 없는 관리자 읽기: AM04 설문 집계·AM05 자유 서술 답변 — 미션 관리 상세
 * 시트의 집계 패널만 로컬에서 「조회하지 못했습니다」로 표시된다.
 */
export const handlers = [
    ...abuseHandlers,
    ...adminEntryHandlers,
    ...adminEventHandlers,
    ...adminMissionHandlers,
    ...adminNotificationHandlers,
    ...adminStatsHandlers,
    ...adminTicketHandlers,
    ...adminUserHandlers,
    ...attendanceHandlers,
    ...bannerHandlers,
    ...drawHandlers,
    ...drawResultHandlers,
    ...entryHandlers,
    ...eventHandlers,
    ...gameHandlers,
    ...missionHandlers,
    ...notificationHandlers,
    ...ticketHandlers,
    ...virtualUserHandlers,
];
