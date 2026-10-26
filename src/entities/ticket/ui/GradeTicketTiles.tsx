import type { TicketGrade } from '@entities/ticket';

import { TICKET_GRADE_IMAGE, TICKET_GRADE_LABEL } from '@entities/ticket';
import { formatNumber } from '@shared/utils/format';

/** 등급 칸 바탕 — 등급 soft 색이라 회색 위 회색처럼 묻히지 않는다 (DESIGN-SYSTEM "Grade") */
const GRADE_TILE: Record<TicketGrade, string> = {
    BRONZE: 'bg-grade-bronze-soft',
    SILVER: 'bg-grade-silver-soft',
    GOLD: 'bg-grade-gold-soft',
    PLATINUM: 'bg-grade-platinum-soft',
};

/**
 * 등급별 응모권 칸 — 등급 그림·이름·장수를 등급 색 칸에 담는다.
 * 내 응모권 현황(보유)과 응모 확인·완료 모달(쓰는 장수)이 같은 꼴을 쓴다
 */
export function GradeTicketTiles({
    items,
    label,
}: {
    /** 보일 등급과 장수 — 장수를 모르면 null */
    items: { grade: TicketGrade; count: number | null }[];
    /** 목록 이름 — 화면 읽기용 */
    label: string;
}) {
    return (
        <ul
            aria-label={label}
            className="grid gap-2"
            style={{ gridTemplateColumns: `repeat(${Math.max(items.length, 1)}, minmax(0, 1fr))` }}
        >
            {items.map(({ grade, count }) => (
                <li
                    key={grade}
                    // 등급 바탕은 다크 모드에도 그대로라 글자는 바탕에 맞춘 고정 잉크색을 쓴다
                    className={`${GRADE_TILE[grade]} text-ink flex items-center gap-2.5 rounded-lg px-3 py-2.5`}
                >
                    <img src={TICKET_GRADE_IMAGE[grade]} alt="" className="h-auto w-9 shrink-0" />
                    <span className="flex min-w-0 flex-col">
                        <span className="text-caption">{TICKET_GRADE_LABEL[grade]}</span>
                        <span className="text-body-sm-bold tabular-nums">
                            {count === null ? '-' : formatNumber(count)}장
                        </span>
                    </span>
                </li>
            ))}
        </ul>
    );
}
