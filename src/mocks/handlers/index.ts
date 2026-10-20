import { abuseHandlers } from './abuse';
import { adminEntryHandlers } from './adminEntry';
import { adminEventHandlers } from './adminEvent';
import { adminNotificationHandlers } from './adminNotification';
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

export const handlers = [
    ...abuseHandlers,
    ...adminEntryHandlers,
    ...adminEventHandlers,
    ...adminNotificationHandlers,
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

// 배포 백엔드에 아직 없는 경로만 가로채는 하이브리드 목업 — 실연동 전환 시
// 해당 도메인을 여기서 빼면 요청이 실서버로 bypass된다 (onUnhandledRequest: 'bypass')
// 괄호 안은 2026-10-19 실서버 실측 기준이다. 배너(B01·AB01~05)·관리자 응모권(AO03~09)은 실연동한다.
// AS01·AM04는 미배포(404)지만 FE에서 아직 호출하지 않아 목업 핸들러도 없다.
export const hybridHandlers = [
    ...abuseHandlers, // /v1/admin/abuse-cases — 배포 미구현(404)
    ...drawHandlers, // /v1/admin/draws*·/wins/*·/cancellations/* — 배포 미구현(404)
    // /v1/games — 서버는 구현됐으나 목록 응답이 spec GameSummary({id,code,name,description})로
    // FE gameSchema(title·dailyLimit·remainingPlays 필수)와 불일치. 제출도 spec의 G03/G04
    // 두 단계가 아닌 비spec 단일 /play를 쓴다 — 게임 계약 정합화 전까지 목업 유지
    ...gameHandlers,
    ...virtualUserHandlers, // /virtual-users — spec外 시연 전용 경로
];
