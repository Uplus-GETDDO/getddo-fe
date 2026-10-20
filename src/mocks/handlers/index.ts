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

// 배포 백엔드에 아직 없는 경로만 가로채는 하이브리드 목업 — 실연동 전환 시
// 해당 도메인을 여기서 빼면 요청이 실서버로 bypass된다 (onUnhandledRequest: 'bypass')
// 괄호 안은 2026-10-19 실서버 실측 기준이다. 배너(B01·AB01~05)·관리자 응모권(AO03~09)은 실연동한다.
// 2026-10-20 실측에서 AO01·AO02·AO06·AO07·AS01도 실연동이 확인됐다 — 신규 관리자 조회는 등록하지 않는다.
// AM04는 미배포(404)지만 FE에서 아직 호출하지 않아 목업 핸들러도 없다.
// 추첨 도메인(AD01~AD09·GD-87·GD-137·GD-199)은 2026-10-20 실측에서 배포 확인(401/405로 라우팅,
// /admin/abuse-cases만 404)됐고 GD-253에서 신계약 정합화를 마쳤다 — 등록 해제해 실서버로 bypass한다.
// 테스트용 handlers 등록과 목업 시드는 그대로 유지한다.
export const hybridHandlers = [
    ...abuseHandlers, // /v1/admin/abuse-cases — 배포 미구현(404, 2026-10-20 실측) — 계약 미확정이라 목업 유지
    // GD-257: 네 게임 G01~G05·서버 보상·T01/T02·ADMIN 차이를 실제 API에서 검증해 배포 등록을 해제했다.
    // gameHandlers는 위 테스트·로컬 개발용 handlers에 유지한다.
    ...virtualUserHandlers, // /virtual-users — spec外 시연 전용 경로
];
