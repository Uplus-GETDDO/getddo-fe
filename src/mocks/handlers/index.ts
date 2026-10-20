import { abuseHandlers } from './abuse';
import { adminEventHandlers } from './adminEvent';
import { adminNotificationHandlers } from './adminNotification';
import { adminTicketHandlers } from './adminTicket';
import { adminUserHandlers } from './adminUser';
import { attendanceHandlers } from './attendance';
import { auditHandlers } from './audit';
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

export const handlers = [
    ...abuseHandlers,
    ...adminEventHandlers,
    ...adminNotificationHandlers,
    ...adminTicketHandlers,
    ...adminUserHandlers,
    ...attendanceHandlers,
    ...auditHandlers,
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

// 배포 백엔드에 아직 없는 경로만 가로채는 하이브리드 목업 — 실연동 전환 시
// 해당 도메인을 여기서 빼면 요청이 실서버로 bypass된다 (onUnhandledRequest: 'bypass')
export const hybridHandlers = [
    ...abuseHandlers, // /v1/admin/abuse-cases — 배포 미구현
    ...adminTicketHandlers, // /v1/admin/ticket-* — 배포 미구현
    ...auditHandlers, // /v1/admin/audit-logs — 이번 버전 제외(ADR-024)
    ...bannerHandlers, // /v1/banners, /v1/admin/banners — 배포 미구현
    ...drawResultHandlers, // /v1/events/{id}/results, /my-result — 배포 미구현
    ...gameHandlers, // /v1/games — 배포 미구현
    ...virtualUserHandlers, // /virtual-users — spec外 시연 전용 경로
];
