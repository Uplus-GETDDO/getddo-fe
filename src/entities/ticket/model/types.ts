import { z } from 'zod';

// spec 공통 — 응모권 등급. 게임·미션 보상은 확률 추첨(브론즈 79.98%·실버 18%·골드 2%·플래티넘 0.02%),
// 출석 보상은 브론즈 고정이다 (getddo-spec 02-domain/ticket.md, ADR-014·016)
export const ticketGradeSchema = z.enum(['BRONZE', 'SILVER', 'GOLD', 'PLATINUM']);

// spec T01 — TicketHolding: 등급·만료 시각이 같은 응모권의 묶음. 만료 임박순으로 내려온다
export const ticketHoldingSchema = z.object({
    grade: ticketGradeSchema,
    expiresAt: z.iso.datetime(),
    count: z.number().int().nonnegative(),
});

// spec T01 — MyTickets: 사용 가능 합계 + 등급별 장수(0인 등급도 포함, 합계는 availableCount와 같다)
// + 등급·만료별 보유 묶음 + 서버 시각
export const myTicketsSchema = z.object({
    availableCount: z.number().int().nonnegative(),
    countByGrade: z.object({
        BRONZE: z.number().int().nonnegative(),
        SILVER: z.number().int().nonnegative(),
        GOLD: z.number().int().nonnegative(),
        PLATINUM: z.number().int().nonnegative(),
    }),
    holdings: z.array(ticketHoldingSchema),
    serverTime: z.iso.datetime(),
});

export type TicketGrade = z.infer<typeof ticketGradeSchema>;
export type TicketHolding = z.infer<typeof ticketHoldingSchema>;
export type MyTickets = z.infer<typeof myTicketsSchema>;
