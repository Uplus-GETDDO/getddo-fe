import type { TicketGrade } from './types';

import bronze from '../assets/ticket-bronze.png';
import gold from '../assets/ticket-gold.png';
import platinum from '../assets/ticket-platinum.png';
import silver from '../assets/ticket-silver.png';

/** 등급별 응모권 그림 — 피그마 image 278 네 장을 한 장씩 잘랐다 (가로 5 : 세로 3, 투명 바탕) */
export const TICKET_GRADE_IMAGE: Record<TicketGrade, string> = {
    BRONZE: bronze,
    SILVER: silver,
    GOLD: gold,
    PLATINUM: platinum,
};

/** 화면에 늘어놓을 때의 등급 순서 — 낮은 등급부터 */
export const TICKET_GRADES: readonly TicketGrade[] = ['BRONZE', 'SILVER', 'GOLD', 'PLATINUM'];
