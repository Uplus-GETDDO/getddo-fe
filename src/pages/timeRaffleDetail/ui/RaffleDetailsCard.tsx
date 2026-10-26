import type { EntryStatistics } from '@entities/entry';
import type { Event } from '@entities/event';

import { useMyEventEntries } from '@entities/entry';
import { describeTicketUsage, MEMBERSHIP_LABEL } from '@entities/event';
import { useMyTickets } from '@entities/ticket';
import { KST_HOUR_MINUTE, formatKst, isSameKstDate } from '@shared/utils/date';
import { formatNumber } from '@shared/utils/format';

/**
 * 모집 시각 — 하루 안에 열고 닫으면 시각만, 날을 넘기면 날짜를 붙인다.
 * 시각만 적으면 며칠짜리 래플이 '17:28 시작 · 14:28 마감'처럼 마감이 시작보다 앞서 보였다
 */
function formatRecruitWindow(startsAt: string, endsAt: string) {
    const at = (iso: string, withDate: boolean) =>
        withDate
            ? `${formatKst(iso, { month: 'long', day: 'numeric' })} ${formatKst(iso, KST_HOUR_MINUTE)}`
            : formatKst(iso, KST_HOUR_MINUTE);
    const withDate = !isSameKstDate(startsAt, endsAt);
    return `${at(startsAt, withDate)} 시작 · ${at(endsAt, withDate)} 마감`;
}

export function RaffleDetailsCard({
    event,
    statistics,
}: {
    event: Event;
    /** 응모 현황(E03) — 페이지가 같은 키를 한 번만 구독해 나눠 준다 */
    statistics?: EntryStatistics;
}) {
    const { data: ticket, isPending: ticketsPending } = useMyTickets();
    const { data: myEntries, isPending: entriesPending } = useMyEventEntries(event.id);

    const detail = event.raffleDetail;
    // 한 번에 여러 장을 쓸 수 있어 횟수 × 차감량으로는 실제 사용량이 나오지 않는다 — E06 실내역 합계로 계산
    const usedTickets = myEntries?.reduce((sum, entry) => sum + entry.deductedTicketCount, 0);
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
        { label: '모집 시각', value: formatRecruitWindow(event.startsAt, event.endsAt) },
        // 자격 등급은 모든 이벤트 응답에 있는 계약 필드다 — 목업 전용 안내 묶음이 없는 래플에서도 보인다
        {
            label: '멤버십 자격',
            value: `${MEMBERSHIP_LABEL[event.membershipRule]} 등급 이상 응모할 수 있어요`,
        },
        /*
         * '1회 차감 수량'으로 두면 가중치 래플이 '1회 1장'으로 읽힌다 — 등급을 골라
         * 누적 상한까지 여러 번 나눠 낼 수 있는 래플이라 쓰는 방식 자체를 적는다 (ADR-010)
         */
        { label: '응모권 사용', value: describeTicketUsage(event) },
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
            value:
                usedTickets != null
                    ? `${formatNumber(usedTickets)}장`
                    : entriesPending
                      ? '불러오는 중'
                      : '조회 실패',
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
