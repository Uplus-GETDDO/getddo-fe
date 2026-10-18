import type { TicketGrade } from './types';

import bronze from '../assets/ticket-bronze.png';
import gold from '../assets/ticket-gold.png';
import silver from '../assets/ticket-silver.png';

/** 등급별 응모권 그림 — 피그마 image 193 (가로 5 : 세로 3, 투명 바탕) */
export const TICKET_GRADE_IMAGE: Record<TicketGrade, string> = {
    BRONZE: bronze,
    SILVER: silver,
    GOLD: gold,
    // 전용 이미지 확정 전에는 은색 응모권 그림을 재사용하고 이름·등급 토큰으로 구분한다.
    PLATINUM: silver,
};

/** 화면에 늘어놓을 때의 등급 순서 — 낮은 등급부터 */
export const TICKET_GRADES: readonly TicketGrade[] = ['BRONZE', 'SILVER', 'GOLD', 'PLATINUM'];
