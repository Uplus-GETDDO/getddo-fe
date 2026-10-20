import type { CSSProperties } from 'react';

import { ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';

import {
    TICKET_GRADE_IMAGE,
    TICKET_GRADE_LABEL,
    TICKET_GRADES,
    TicketBalanceStatus,
    useMyTickets,
    useTicketHistoryCounts,
    ticketMonthRange,
} from '@entities/ticket';
import { useCountUp } from '@shared/hooks/useCountUp';
import { Button } from '@shared/ui/button';
import { SkeletonText } from '@shared/ui/skeleton';
import { formatNumber } from '@shared/utils/format';

import ticketCharacter from '../assets/ticket-character.png';
import { TicketGradeInfo } from './TicketGradeInfo';

/** 응모권 모양 — 양옆 절취선 높이를 반원으로 파낸다 (왼쪽 반·오른쪽 반에 각각 구멍 하나) */
// 절취선 높이에 판다 — 카드 아래 여백(p-5 1.25rem) + 내역 줄(body-sm 1.375rem) + 절취선 위 여백(pt-3 0.75rem)
const PERFORATION_FROM_BOTTOM = '3.375rem';
const TICKET_NOTCH_MASK: CSSProperties = {
    mask: `radial-gradient(circle at 0 calc(100% - ${PERFORATION_FROM_BOTTOM}), transparent 14px, #000 14.5px) left / 51% 100% no-repeat, radial-gradient(circle at 100% calc(100% - ${PERFORATION_FROM_BOTTOM}), transparent 14px, #000 14.5px) right / 51% 100% no-repeat`,
};

interface TicketWalletProps {
    /** 이번 달 적립·사용을 셀 기준 시각 */
    now: Date;
    /** 절취선 아래 오른쪽 바로가기 — 미션은 "내역", 겟또타임은 "응모권 모으러 가기" */
    action: { to: string; label: string };
}

/**
 * 내 응모권 지갑 — 미션 "오늘의 적립"과 겟또타임 머리 오른쪽에 같은 모양으로 둔다.
 * 사용 가능 장수, 등급별 보유(피그마 image 193 응모권 그림), 이번 달 적립·사용, 바로가기.
 * 응모권 모양(양옆 반원 홈·절취선)이고, 응모권을 든 캐릭터가 오른쪽 위에 걸터앉는다
 */
export function TicketWallet({ now, action }: TicketWalletProps) {
    const ticketsQuery = useMyTickets();
    const tickets = ticketsQuery.data;
    const summary = useTicketHistoryCounts(
        (['GRANT', 'REFUND', 'USE', 'EXPIRE'] as const).map((operationType) => ({
            operationType,
            ...ticketMonthRange(now),
        })),
    );
    const monthly = summary.counts.every((count) => count !== undefined)
        ? {
              earned: summary.counts[0]! + summary.counts[1]!,
              used: summary.counts[2]! + summary.counts[3]!,
          }
        : undefined;
    const balance = useCountUp(tickets?.availableCount);
    // 불러오기 전에는 '-' 대신 둥근 글줄로 숫자 자리를 잡는다
    const format = (n: number | undefined) =>
        n == null ? <SkeletonText className="w-6" /> : formatNumber(n);

    return (
        <div className="relative mt-8 lg:mt-0">
            <img
                src={ticketCharacter}
                alt=""
                className="pointer-events-none absolute -top-9 right-2 z-10 size-28 object-contain"
            />
            {/*
             * 왼쪽 진행 칸들처럼 테두리 없이 옅은 그림자로 띄운다. 홈을 파내는 mask가 box-shadow까지 잘라
             * 그림자는 바깥 감싸개의 drop-shadow로 준다 — 파인 홈 모양을 그대로 따라간다
             */}
            <div className="drop-shadow-[0_1px_2px_rgb(from_var(--color-ink)_r_g_b_/_0.1)]">
                <div className="bg-surface-page rounded-2xl p-5 pt-6" style={TICKET_NOTCH_MASK}>
                    <p className="text-body-sm text-fg-secondary flex items-center gap-1">
                        사용 가능 응모권
                        <TicketGradeInfo />
                    </p>
                    <TicketBalanceStatus query={ticketsQuery} />
                    {(tickets || ticketsQuery.isPending) && (
                        <p className="text-title-2 text-fg-primary tabular-nums">
                            {format(balance)}장
                        </p>
                    )}

                    {/*
                     * 등급 칸은 바탕 없이 얇은 세로선으로만 나눈다 — 응모권 그림이 이미 등급 색이라 바탕까지 칠하면
                     * 회색(실버 바탕 포함)이 다시 생기고 노란 가게 배너 위에서 색이 많아진다
                     */}
                    {(tickets || ticketsQuery.isPending) && (
                        <ul
                            className="divide-border-default mt-4 grid grid-cols-3 divide-x"
                            aria-label="등급별 보유 응모권"
                        >
                            {TICKET_GRADES.map((grade) => (
                                <li
                                    key={grade}
                                    className="flex flex-col items-center gap-1 px-1.5 pt-2 pb-1.5"
                                >
                                    <img
                                        src={TICKET_GRADE_IMAGE[grade]}
                                        alt=""
                                        className="h-auto w-full max-w-11"
                                    />
                                    <span className="text-caption text-fg-secondary">
                                        {TICKET_GRADE_LABEL[grade]}
                                    </span>
                                    <span className="text-body-sm-bold text-fg-primary tabular-nums">
                                        {format(tickets?.countByGrade[grade])}장
                                    </span>
                                </li>
                            ))}
                        </ul>
                    )}

                    {summary.isError && (
                        <Button
                            variant="secondary"
                            disabled={summary.isFetching}
                            onClick={summary.refetch}
                        >
                            월 합계 다시 시도
                        </Button>
                    )}
                    {/* 절취선 */}
                    <div className="border-border-default mt-4 flex items-center justify-between gap-3 border-t border-dashed pt-3">
                        <span
                            aria-live="polite"
                            className="text-caption text-fg-tertiary whitespace-nowrap"
                        >
                            {summary.isError ? (
                                '이번 달 합계 조회 실패'
                            ) : (
                                <>
                                    이번 달 적립 {format(monthly?.earned)} · 사용{' '}
                                    {format(monthly?.used)}
                                </>
                            )}
                        </span>
                        <Link
                            to={action.to}
                            className="text-body-sm-bold text-fg-primary focus-visible:ring-border-focus flex shrink-0 items-center gap-0.5 rounded-sm whitespace-nowrap hover:underline focus-visible:ring-2 focus-visible:outline-none"
                        >
                            {action.label}
                            <ChevronRight className="size-4" />
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
}
