import { Link } from 'react-router-dom';

import {
    ticketMonthRange,
    TicketBalanceStatus,
    useMyTickets,
    useTicketHistoryCounts,
} from '@entities/ticket';
import { useVirtualClock } from '@shared/model/virtualClock';
import { Button } from '@shared/ui/button';
import { PageHeader } from '@shared/ui/page-header';
import { SkeletonCard } from '@shared/ui/skeleton';
import { formatKst, KST_HOUR_MINUTE, kstDayDiff } from '@shared/utils/date';

import type { ExpiringSoon } from './ui/TicketWalletHero';

import { ExpiringCard } from './ui/ExpiringCard';
import { GradeGuideCard } from './ui/GradeGuideCard';
import { TicketHistoryCard } from './ui/TicketHistoryCard';
import { TicketWalletHero } from './ui/TicketWalletHero';

/**
 * 내 응모권 — 마이페이지 "응모권" 칸·"응모권 내역 → 전체 보기"가 여는 페이지.
 * 큰 응모권(사용 가능·등급 구성·곧 만료·이번 달 받은/쓴) 아래에 응모권 기록, 옆에 만료 예정·등급 안내.
 */
export function MyTicketsPage() {
    const ticketsQuery = useMyTickets();
    const { data: tickets, isPending: ticketsPending } = ticketsQuery;
    const clock = useVirtualClock();
    const now = clock.now();

    const monthly = useTicketHistoryCounts([
        { operationType: 'GRANT', ...ticketMonthRange(now) },
        { operationType: 'USE', ...ticketMonthRange(now) },
    ]);

    // 가장 이른 만료 시각에 걸린 장수 — 같은 시각의 묶음(등급만 다른)을 합친다
    const soonest = [...(tickets?.holdings ?? [])]
        .filter((holding) => holding.count > 0)
        .sort((a, b) => new Date(a.expiresAt).getTime() - new Date(b.expiresAt).getTime())[0];
    const expiring: ExpiringSoon | null = soonest
        ? {
              count: (tickets?.holdings ?? [])
                  .filter((holding) => holding.expiresAt === soonest.expiresAt)
                  .reduce((sum, holding) => sum + holding.count, 0),
              expiryLabel: `${formatKst(soonest.expiresAt, { month: 'long', day: 'numeric' })} ${formatKst(soonest.expiresAt, KST_HOUR_MINUTE)}`,
              dDay: kstDayDiff(soonest.expiresAt, now),
          }
        : null;

    return (
        <main className="mx-auto flex w-full max-w-312 flex-col gap-6 px-6 pb-28">
            <PageHeader
                backTo="/mypage"
                backLabel="마이페이지"
                title="내 응모권"
                description="가진 응모권과 만료일, 받고 쓴 기록을 한곳에서 봐요."
                action={
                    <Button asChild variant="secondary">
                        <Link to="/missions">응모권 모으러 가기</Link>
                    </Button>
                }
            />

            {/* 지갑 머리 자리를 잡아 둔다 */}
            {ticketsPending && <SkeletonCard className="h-56" />}
            <TicketBalanceStatus query={ticketsQuery} />
            {tickets && (
                <TicketWalletHero
                    tickets={tickets}
                    expiring={expiring}
                    monthReceived={monthly.counts[0]}
                    monthUsed={monthly.counts[1]}
                    summaryError={monthly.isError}
                    summaryFetching={monthly.isFetching}
                    onRetrySummary={monthly.refetch}
                />
            )}

            <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_22.5rem]">
                <TicketHistoryCard now={now} />
                <div className="flex flex-col gap-4">
                    {tickets && <ExpiringCard holdings={tickets.holdings} />}
                    <GradeGuideCard />
                </div>
            </div>
        </main>
    );
}
