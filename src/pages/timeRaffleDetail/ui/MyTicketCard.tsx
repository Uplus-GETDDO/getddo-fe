import type { Event } from '@entities/event';

import { GradeTicketTiles, TICKET_GRADES, useMyTickets } from '@entities/ticket';
import { formatNumber } from '@shared/utils/format';

/**
 * 내 응모권 현황 — 왼쪽은 이번 겟또타임에 낸 것, 오른쪽은 지금 가진 것.
 *
 * 흰 카드 안을 회색 칸으로 다시 채우면 칸이 겹겹이 무거워 보여, 두 묶음은 세로 선으로만 나눈다.
 * 보유 응모권은 등급 soft 색 칸에 등급 그림·이름·장수를 둬 배너의 응모권 지갑과 같은 꼴로 읽히게 하고,
 * 낸 장수는 한도가 있으면 막대로 보여 얼마나 더 낼 수 있는지 한눈에 읽히게 한다
 */
export function MyTicketCard({ event }: { event: Event }) {
    const { data: ticket, isPending } = useMyTickets();

    const usesTickets = event.eventType === 'TICKET';
    const entryCount = event.myEntryCount ?? 0;
    // 한 번에 여러 장을 쓸 수 있어 횟수 × 차감량으로는 실제 사용량이 나오지 않는다
    const usedTickets = event.myTicketCount ?? entryCount * event.requiredTickets;
    const limit = usesTickets ? event.maxTicketsPerUser : null;

    return (
        <section className="bg-surface-page border-border-default flex flex-col gap-5 rounded-2xl border p-5">
            <h2 className="text-subhead text-fg-primary">내 응모권 현황</h2>
            <div className="divide-border-default grid gap-5 max-lg:divide-y lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] lg:gap-0 lg:divide-x">
                <div className="flex flex-col gap-3 max-lg:pb-5 lg:pr-6">
                    <p className="text-body-sm text-fg-tertiary">이번 겟또타임</p>
                    <p className="text-body-sm text-fg-secondary flex flex-wrap items-baseline gap-x-2">
                        <span className="text-body-bold text-fg-primary tabular-nums">
                            {formatNumber(entryCount)}회 응모
                        </span>
                        {usesTickets && <span>응모권 {formatNumber(usedTickets)}장 사용</span>}
                    </p>
                    {limit != null && (
                        <div className="mt-auto flex flex-col gap-1.5">
                            <div
                                role="progressbar"
                                aria-label="이번 겟또타임에 쓴 응모권"
                                aria-valuemin={0}
                                aria-valuemax={limit}
                                aria-valuenow={Math.min(usedTickets, limit)}
                                className="bg-surface-sunken h-2 overflow-hidden rounded-full"
                            >
                                <div
                                    className="bg-ticket-primary h-full rounded-full transition-[width]"
                                    style={{
                                        width: `${Math.min(100, (usedTickets / limit) * 100)}%`,
                                    }}
                                />
                            </div>
                            <p className="text-caption text-fg-tertiary">
                                {usedTickets >= limit
                                    ? `최대 ${limit}장을 모두 썼어요`
                                    : `최대 ${limit}장 중 ${limit - usedTickets}장 더 쓸 수 있어요`}
                            </p>
                        </div>
                    )}
                </div>

                <div className="flex flex-col gap-3 lg:pl-6">
                    <p className="text-body-sm text-fg-tertiary flex items-baseline justify-between gap-3">
                        보유 응모권
                        <span className="text-body-bold text-fg-primary tabular-nums">
                            {ticket
                                ? `${formatNumber(ticket.availableCount)}장`
                                : isPending
                                  ? '불러오는 중'
                                  : '조회 실패'}
                        </span>
                    </p>
                    {(ticket || isPending) && (
                        <GradeTicketTiles
                            label="등급별 보유 응모권"
                            items={TICKET_GRADES.map((grade) => ({
                                grade,
                                count: ticket?.countByGrade[grade] ?? null,
                            }))}
                        />
                    )}
                </div>
            </div>
        </section>
    );
}
