import type { TicketGrade } from './types';

import bronze from '../assets/ticket-bronze.png';
import gold from '../assets/ticket-gold.png';
import platinum from '../assets/ticket-platinum.png';
import random from '../assets/ticket-random.png';
import silver from '../assets/ticket-silver.png';

/** 등급별 응모권 그림 — 피그마 02 Screens image 310 앞 네 장을 한 장씩 잘랐다 (291×190, 투명 바탕). 글자가 진해 작게 써도 읽힌다 */
export const TICKET_GRADE_IMAGE: Record<TicketGrade, string> = {
    BRONZE: bronze,
    SILVER: silver,
    GOLD: gold,
    PLATINUM: platinum,
};

/**
 * 받을 때 등급이 정해지는 응모권('?' 응모권) — 미션·게임 보상처럼 지급 시 확률로 등급을 뽑는 경우.
 * 출석처럼 등급이 정해진 보상은 TICKET_GRADE_IMAGE의 그 등급 그림을 쓴다. 피그마 02 Screens image 310의 다섯째 장
 */
export const TICKET_RANDOM_IMAGE = random;

/** 화면에 늘어놓을 때의 등급 순서 — 낮은 등급부터 */
export const TICKET_GRADES: readonly TicketGrade[] = ['BRONZE', 'SILVER', 'GOLD', 'PLATINUM'];
