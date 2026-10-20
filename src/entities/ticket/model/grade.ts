import type { TicketGrade } from './types';

// 등급 표시 이름 — 응모권 이력·보유 묶음에서 등급을 한글로 읽힐 때 쓴다
export const TICKET_GRADE_LABEL: Record<TicketGrade, string> = {
    BRONZE: '브론즈',
    SILVER: '실버',
    GOLD: '골드',
    PLATINUM: '플래티넘',
};

// 등급 진한 색 점 — 알약·내역 줄에서 등급을 색으로 구분한다 (DESIGN-SYSTEM "Grade — 응모권 등급")
export const TICKET_GRADE_DOT: Record<TicketGrade, string> = {
    BRONZE: 'bg-grade-bronze',
    SILVER: 'bg-grade-silver',
    GOLD: 'bg-grade-gold',
    PLATINUM: 'bg-grade-platinum',
};

// 가중치를 적용하는 겟또타임에서 장당 추첨 가중치 — getddo-spec 02-domain/drawing.md "가중치 및 중복 당첨"
export const TICKET_GRADE_WEIGHT: Record<TicketGrade, number> = {
    BRONZE: 1,
    SILVER: 3,
    GOLD: 5,
    PLATINUM: 10,
};

// 게임·미션 보상 1장의 등급 확률(%) — getddo-spec 02-domain/ticket.md "게임·미션 보상의 등급 추첨". 출석은 브론즈 고정.
// 얻는 확률은 보상 규칙이라 안내하지만, 당첨 확률은 어디에도 보여 주지 않는다 (요구사항 §7)
export const TICKET_GRADE_ODDS: Record<TicketGrade, number> = {
    BRONZE: 79.98,
    SILVER: 18,
    GOLD: 2,
    PLATINUM: 0.02,
};
