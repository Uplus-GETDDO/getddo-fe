import type { Event } from '@entities/event';

import { useEntryStatistics } from '@entities/entry';
import { useMyTickets } from '@entities/ticket';
import { KST_HOUR_MINUTE, formatKst } from '@shared/utils/date';
import { formatNumber } from '@shared/utils/format';

export function RaffleDetailsCard({ event }: { event: Event }) {
    const { data: ticket, isPending: ticketsPending } = useMyTickets();
    // 히어로와 같은 쿼리 키라 요청은 합쳐진다
    const { data: statistics } = useEntryStatistics(event.id, { isOpen: event.status === 'open' });

    const detail = event.raffleDetail;
    const entryCount = event.myEntryCount ?? 0;
    // 한 번에 여러 장을 쓸 수 있어 횟수 × 차감량으로는 실제 사용량이 나오지 않는다
    const usedTickets = event.myTicketCount ?? entryCount * event.requiredTickets;
    const paragraphs = detail?.paragraphs ?? [event.description];

    type Spec = { label: string; value: string | null };
    // 13줄이 한 줄로 길게 이어지던 표를 '상품·일정'과 '응모 현황' 두 묶음으로 나눈다 — 넓은 화면에서는 나란히 둔다
    const productSpecs: Spec[] = [
        // 경품 요약은 상세(E02)에만 있다 — 값이 없으면 해당 행을 숨긴다 (spec EventSummary)
        { label: '상품 구성', value: detail?.prizeComposition ?? event.prizeName ?? null },
        {
            label: '추첨 인원',
            value:
                event.winnerCount != null
                    ? event.winnerCount === 1
                        ? '단 1명'
                        : `${formatNumber(event.winnerCount)}명`
                    : null,
        },
        { label: '배송 일정', value: detail?.shippingSchedule ?? null },
        {
            label: '모집 시각',
            value: `KST ${formatKst(event.startsAt, KST_HOUR_MINUTE)} 시작 · KST ${formatKst(event.endsAt, KST_HOUR_MINUTE)} 마감`,
        },
        { label: '멤버십 자격', value: detail?.membershipNote ?? null },
        {
            label: '1회 차감 수량',
            value:
                event.requiredTickets === 0
                    ? '응모권 없이 참여'
                    : `1회 응모 시 ${event.requiredTickets}장`,
        },
    ];
    const entrySpecs: Spec[] = [
        {
            label: '보유 응모권',
            value: ticket
                ? `${formatNumber(ticket.availableCount)}장`
                : ticketsPending
                  ? '불러오는 중'
                  : '조회 실패',
        },
        {
            label: '이번 이벤트 차감',
            value: `${formatNumber(usedTickets)}장`,
        },
        {
            label: '응모자 수',
            value: statistics ? `${formatNumber(statistics.participantCount)}명` : null,
        },
        {
            label: '총 차감 응모권',
            value: statistics ? `${formatNumber(statistics.totalSpentTicketCount)}장` : null,
        },
    ];

    return (
        <section className="bg-surface-page border-border-default flex flex-col gap-6 rounded-2xl border p-5">
            <h2 className="text-subhead text-fg-primary">이벤트 상세 안내</h2>

            <div className="flex flex-col gap-3">
                {paragraphs.map((paragraph) => (
                    <p key={paragraph} className="text-body text-fg-secondary">
                        {paragraph}
                    </p>
                ))}
            </div>

            <hr className="border-border-default" />

            <div className="grid gap-8 lg:grid-cols-2">
                <SpecGroup title="상품·일정" specs={productSpecs} />
                <SpecGroup title="응모 현황" specs={entrySpecs} />
            </div>
        </section>
    );
}

function SpecGroup({
    title,
    specs,
}: {
    title: string;
    specs: { label: string; value: string | null }[];
}) {
    return (
        <div className="flex flex-col gap-3">
            <h3 className="text-body-sm-bold text-fg-tertiary">{title}</h3>
            <dl className="flex flex-col gap-3">
                {specs
                    .filter((spec) => spec.value != null)
                    .map(({ label, value }) => (
                        // 좁은 화면에서는 위아래로 쌓는다 — 라벨 칸을 넓게 잡으면 값 칸이 너무 좁아진다
                        <div key={label} className="flex flex-col sm:flex-row sm:items-start">
                            {/* 굵은 값이 줄줄이 이어지면 표 전체가 무거워 보여, 굵기 대신 색(라벨 연하게·값 진하게)으로만 나눈다 */}
                            <dt className="text-body text-fg-tertiary sm:w-32 sm:shrink-0">
                                {label}
                            </dt>
                            <dd className="text-body text-fg-primary min-w-0 sm:flex-1">{value}</dd>
                        </div>
                    ))}
            </dl>
        </div>
    );
}
