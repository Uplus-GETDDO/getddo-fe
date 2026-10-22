import { z } from 'zod';

import type { ticketStatusSchema } from './history';

import { ticketHistorySchema } from './history';

// 관리자 응모권 조회 계약 — 2026-10-12 백엔드(윤태형) 답변 기준이다.
// getddo-spec 05-api/ticket.md에는 아직 반영 전이므로 바뀌면 이 파일과 목업만 고친다.
// AO03·AO04·AO08·AO09(지급·정합성·반환 조회)는 GD-293에서 화면과 함께 스키마를 걷었다 —
// 계약 자체는 채택 상태로 남는다

// 지급 원본 구분 — 대시보드 응모권 추이(AS01)의 출처별 분해에도 쓴다
export const ticketSourceTypeSchema = z.enum(['ATTENDANCE', 'MISSION', 'GAME']);

// AO05 — TicketHistory 전체 + 사용자·이벤트·미션 표시 이름 (해당 없으면 null)
export const adminTicketHistorySchema = ticketHistorySchema.extend({
    userId: z.string(),
    userName: z.string(),
    eventTitle: z.string().nullish(),
    missionTitle: z.string().nullish(),
});

export type TicketSourceType = z.infer<typeof ticketSourceTypeSchema>;
export type AdminTicketHistory = z.infer<typeof adminTicketHistorySchema>;

export const TICKET_SOURCE_TYPE_LABEL: Record<TicketSourceType, string> = {
    ATTENDANCE: '출석',
    MISSION: '미션',
    GAME: '게임',
};

export const TICKET_STATUS_LABEL: Record<z.infer<typeof ticketStatusSchema>, string> = {
    AVAILABLE: '사용 가능',
    RETURNED: '반환됨',
    SPENT: '사용됨',
    EXPIRED: '만료',
};

export const TICKET_OPERATION_LABEL: Record<
    z.infer<typeof ticketHistorySchema>['operationType'],
    string
> = {
    GRANT: '지급',
    USE: '사용',
    REFUND: '반환',
    EXPIRE: '만료',
    CORRECTION: '정정',
};
