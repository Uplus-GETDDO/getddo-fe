import { TicketGradePill, type TicketHolding } from '@entities/ticket';
import { formatKst, KST_HOUR_MINUTE } from '@shared/utils/date';

/**
 * 만료 예정 — 보유 묶음(T01 holdings: 등급·만료 시각이 같은 응모권)을 만료가 이른 순으로.
 * 만료 시각은 분까지 정확히 보여 준다 (지급분 다음 달 1일 00:00, 반환분은 반환한 달의 다음 달 말까지)
 */
export function ExpiringCard({ holdings }: { holdings: TicketHolding[] }) {
    const sorted = holdings
        .filter((holding) => holding.count > 0)
        .sort((a, b) => new Date(a.expiresAt).getTime() - new Date(b.expiresAt).getTime());
    return (
        <section className="bg-surface-page border-border-default flex flex-col gap-4 rounded-2xl border p-6 shadow-md">
            <h2 className="text-title-3 text-fg-primary">만료 예정</h2>
            {sorted.length === 0 ? (
                <p className="text-body-sm text-fg-tertiary">가진 응모권이 없어요.</p>
            ) : (
                <ul className="flex flex-col gap-3">
                    {sorted.map((holding) => (
                        <li
                            key={`${holding.grade}-${holding.expiresAt}`}
                            className="flex items-center justify-between gap-3"
                        >
                            <TicketGradePill
                                grade={holding.grade}
                                count={holding.count}
                                unit="장"
                            />
                            <span className="text-caption text-fg-secondary">
                                {formatKst(holding.expiresAt, { month: 'long', day: 'numeric' })}{' '}
                                {formatKst(holding.expiresAt, KST_HOUR_MINUTE)}
                            </span>
                        </li>
                    ))}
                </ul>
            )}
            <p className="text-caption text-fg-tertiary break-keep">
                일반 지급분은 다음 달 1일 0시, 반환분은 반환한 달의 다음 달 말까지 쓸 수 있어요.
            </p>
        </section>
    );
}
