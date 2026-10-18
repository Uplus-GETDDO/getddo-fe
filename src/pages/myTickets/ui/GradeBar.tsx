import { motion, useReducedMotion } from 'framer-motion';

import { TICKET_GRADES, type TicketGrade } from '@entities/ticket';

const GRADE_FILL: Record<TicketGrade, string> = {
    BRONZE: 'bg-grade-bronze',
    SILVER: 'bg-grade-silver',
    GOLD: 'bg-grade-gold',
    PLATINUM: 'bg-grade-platinum',
};

/**
 * 등급 구성 막대 — 한 줄짜리 막대를 등급 비율로 나눈다.
 * 바깥 양 끝만 둥글게 하고 등급 사이는 흰 2px 틈으로만 나눠, 조각마다 둥글어 끊겨 보이지 않게 한다.
 * 처음 보일 때 왼쪽부터 차오른다 (동작 줄이기 설정이면 바로 보인다)
 */
export function GradeBar({ countByGrade }: { countByGrade: Record<TicketGrade, number> }) {
    const reduceMotion = useReducedMotion();
    const total = TICKET_GRADES.reduce((sum, grade) => sum + countByGrade[grade], 0);
    if (total === 0) return null;
    const grades = TICKET_GRADES.filter((grade) => countByGrade[grade] > 0);

    return (
        <div aria-hidden className="bg-surface-sunken h-2.5 overflow-hidden rounded-full">
            <motion.div
                className="flex h-full"
                initial={reduceMotion ? false : { clipPath: 'inset(0 100% 0 0)' }}
                animate={{ clipPath: 'inset(0 0% 0 0)' }}
                transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1], delay: 0.1 }}
            >
                {grades.map((grade, index) => (
                    <span
                        key={grade}
                        className={`${GRADE_FILL[grade]} h-full ${index > 0 ? 'border-surface-page border-l-2' : ''}`}
                        style={{ width: `${(countByGrade[grade] / total) * 100}%` }}
                    />
                ))}
            </motion.div>
        </div>
    );
}
