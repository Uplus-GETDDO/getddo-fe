import { Clock } from 'lucide-react';

import {
    TICKET_GRADE_LABEL,
    TICKET_GRADE_WEIGHT,
    TICKET_GRADES,
    type MyTickets,
    type TicketGrade,
} from '@entities/ticket';
import { Badge } from '@shared/ui/badge';
import { TICKET_OUTLINE_FILTER, TICKET_SHADOW_FILTER } from '@shared/ui/ticket-card';
import { formatNumber } from '@shared/utils/format';

import { GradeBar } from './GradeBar';

// 등급 막대·범례 점 색 — 등급 진한 색 (DESIGN-SYSTEM "Grade")
const GRADE_DOT: Record<TicketGrade, string> = {
    BRONZE: 'bg-grade-bronze',
    SILVER: 'bg-grade-silver',
    GOLD: 'bg-grade-gold',
    PLATINUM: 'bg-grade-platinum',
};

/**
 * 넓은 화면에서 절취선(오른쪽 칸 왼쪽 끝) 위·아래에 반지름 12 구멍을 실제로 도려낸다.
 * 모양을 따라 윤곽선·그림자를 그리도록 테두리 대신 drop-shadow 필터를 쓴다 (공용 TicketCard와 같은 방식)
 */
const PUNCH_MASK =
    'lg:[mask-image:radial-gradient(circle_12px_at_calc(100%_-_25rem)_0,transparent_98%,black_100%),radial-gradient(circle_12px_at_calc(100%_-_25rem)_100%,transparent_98%,black_100%)] lg:[mask-composite:intersect]';

export interface ExpiringSoon {
    count: number;
    /** "11월 1일 00:00" */
    expiryLabel: string;
    dDay: number;
}

/**
 * 내 응모권 머리 — 큰 응모권 한 장. 왼쪽은 사용 가능 장수와 등급 구성(막대 + 범례·당첨 기회),
 * 절취선 오른쪽은 곧 만료될 장수와 이번 달 받은·쓴 장수
 */
export function TicketWalletHero({
    tickets,
    expiring,
    monthReceived,
    monthUsed,
}: {
    tickets: MyTickets;
    expiring: ExpiringSoon | null;
    monthReceived: number;
    monthUsed: number;
}) {
    const total = tickets.availableCount;
    return (
        <div style={{ filter: TICKET_SHADOW_FILTER }}>
            <div style={{ filter: TICKET_OUTLINE_FILTER }}>
                <section
                    aria-label="내 응모권 요약"
                    className={`bg-surface-page grid rounded-2xl lg:min-h-64 lg:grid-cols-[minmax(0,1fr)_25rem] ${PUNCH_MASK}`}
                >
                    <div className="flex flex-col justify-between gap-8 p-6 lg:p-8">
                        <div className="flex flex-col gap-1">
                            <span className="text-body-sm text-fg-secondary">사용 가능 응모권</span>
                            <span className="text-title-1 text-fg-primary">
                                {formatNumber(total)}장
                            </span>
                        </div>
                        <div className="flex flex-col gap-3">
                            <GradeBar countByGrade={tickets.countByGrade} />
                            <ul className="flex flex-wrap gap-x-5 gap-y-1">
                                {TICKET_GRADES.map((grade) => (
                                    <li key={grade} className="flex items-center gap-1.5">
                                        <span
                                            aria-hidden
                                            className={`${GRADE_DOT[grade]} size-2 rounded-full`}
                                        />
                                        <span className="text-body-sm-bold text-fg-primary">
                                            {TICKET_GRADE_LABEL[grade]}{' '}
                                            {formatNumber(tickets.countByGrade[grade])}장
                                        </span>
                                        <span className="text-caption text-fg-tertiary">
                                            당첨 기회 {TICKET_GRADE_WEIGHT[grade]}배
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>

                    <div className="relative flex flex-col justify-between gap-6 p-6 lg:p-8">
                        {/* 절취선 — 좁은 화면은 위쪽 가로, 넓은 화면은 왼쪽 세로 점선 */}
                        <span
                            aria-hidden
                            className="border-border-strong pointer-events-none absolute border-dashed max-lg:inset-x-6 max-lg:top-0 max-lg:border-t lg:inset-y-5 lg:left-0 lg:border-l"
                        />
                        <div className="flex flex-col gap-3">
                            <div className="flex items-center gap-2">
                                <Clock aria-hidden className="text-fg-secondary size-4" />
                                <span className="text-body-sm text-fg-secondary">곧 만료돼요</span>
                                {expiring && (
                                    <Badge size="sm">
                                        {expiring.dDay <= 0 ? 'D-DAY' : `D-${expiring.dDay}`}
                                    </Badge>
                                )}
                            </div>
                            {expiring ? (
                                <p className="flex items-baseline gap-2">
                                    <span className="text-title-2 text-fg-primary">
                                        {formatNumber(expiring.count)}장
                                    </span>
                                    <span className="text-body-sm text-fg-tertiary">
                                        {expiring.expiryLabel} 만료
                                    </span>
                                </p>
                            ) : (
                                <p className="text-body-sm text-fg-tertiary">
                                    곧 만료될 응모권이 없어요.
                                </p>
                            )}
                        </div>
                        <dl className="border-border-default grid grid-cols-2 rounded-xl border">
                            <div className="flex flex-col gap-1 px-5 py-4">
                                <dt className="text-body-sm text-fg-secondary">이번 달 받은</dt>
                                <dd className="text-subhead text-fg-primary">
                                    +{formatNumber(monthReceived)}장
                                </dd>
                            </div>
                            <div className="border-border-default flex flex-col gap-1 border-l px-5 py-4">
                                <dt className="text-body-sm text-fg-secondary">이번 달 쓴</dt>
                                <dd className="text-subhead text-fg-primary">
                                    −{formatNumber(monthUsed)}장
                                </dd>
                            </div>
                        </dl>
                    </div>
                </section>
            </div>
        </div>
    );
}
