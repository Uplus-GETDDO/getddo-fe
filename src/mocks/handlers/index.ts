import { abuseHandlers } from './abuse';
import { adminEntryHandlers } from './adminEntry';
import { adminEventHandlers } from './adminEvent';
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
 * 목업이 덮지 않는 관리자 화면 두 곳:
 *   미션 관리   GET /v1/admin/missions …
 *   출석 정책   GET /v1/admin/policies/attendance/daily · /streak
 * 둘 다 로컬에서만 「조회하지 못했습니다」가 뜨고, 실서버·Vercel에서는 정상이다
 * (2026-10-23 실측 확인). 마무리 단계라 핸들러를 만들지 않기로 했다 — 로컬에서 그
 * 화면을 보며 개발해야 할 일이 생기면 그때 추가한다.
 */
export const handlers = [
    ...abuseHandlers,
    ...adminEntryHandlers,
    ...adminEventHandlers,
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
