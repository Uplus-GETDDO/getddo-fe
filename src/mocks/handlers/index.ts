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

// 로컬 개발·테스트 전용 전체 목업 — 배포 빌드는 VITE_ENABLE_MSW=false라
// 브라우저 목업이 시작되지 않고 모든 요청이 실서버로 간다
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
