import type { Event } from '@entities/event';

import { useImageFallback } from '@shared/hooks/useImageFallback';
import { BulletList } from '@shared/ui/bullet-list';
import { KST_HOUR_MINUTE, formatKst, formatYmd } from '@shared/utils/date';
import { formatNumber } from '@shared/utils/format';

/** 멤버십 자격 문구 — 이벤트마다 최소 등급이 다르다 */
const MEMBERSHIP_NOTE: Record<Event['membershipRule'], string> = {
    excellent: '우수 등급 이상이면 참여할 수 있어요.',
    vip: 'VIP 등급 이상만 참여할 수 있어요.',
    vvip: 'VVIP 등급만 참여할 수 있어요.',
};

// 모든 이벤트에 공통인 운영 정책 고지
const POLICY_NOTES = [
    '개별 당첨 취소는 관리자가 사유를 기록해 처리하며, 이를 이유로 응모권을 반환하거나 회수하지 않습니다.',
    '당첨자 명단은 관리자의 명시적인 발표 요청 후 공개합니다. 이벤트 취소 시 차감한 응모권은 원래 등급으로 반환합니다.',
    '경품은 당첨자 발표 후 순차 지급되며, 사정에 따라 동일 가치의 다른 경품으로 대체될 수 있습니다.',
];

/**
 * 이벤트 상세 본문.
 *
 * 운영자가 만든 상세 이미지 한 장이 본문이다 (실제 U+ 이벤트 페이지와 같은 구조).
 * 그 이미지가 아직 없는 이벤트는 본문이 통째로 비어 버리므로, 계약이 이미 주는 값
 * (경품·추첨 인원·기간·참여 조건)으로 글로 된 본문을 대신 세운다. 이미지가 들어오면
 * 코드를 고치지 않아도 이미지 본문으로 바뀐다.
 *
 * 유의사항은 이미지에 그려져 있어도 따로 둔다 — 이미지 안 글자는 화면 읽기로 읽히지 않는다.
 *
 * 주소가 있어도 열리지 않으면 글 본문으로 돌아간다 — 깨진 이미지 아이콘만 남으면 본문이 없는 것과 같다.
 */
export function EventDetailBody({ event }: { event: Event }) {
    const detail = useImageFallback(event.detailImageUrl);

    return (
        <div className="flex flex-col gap-10">
            {detail.shown ? (
                <img
                    src={event.detailImageUrl!}
                    alt={`${event.title} 상세 안내`}
                    loading="lazy"
                    onError={detail.onError}
                    className="mx-auto block h-auto w-full max-w-270"
                />
            ) : (
                <EventTextBody event={event} />
            )}

            <section className="border-border-default flex flex-col gap-3 border-t pt-8">
                <h2 className="text-body-sm-bold text-fg-tertiary">유의사항</h2>
                <BulletList items={POLICY_NOTES} size="sm" />
            </section>
        </div>
    );
}

/** 상세 이미지가 없을 때의 글 본문 — 이벤트 계약(E02)이 주는 값만 쓴다 */
function EventTextBody({ event }: { event: Event }) {
    const specs: { label: string; value: string }[] = [
        // 경품 요약은 상세(E02)에만 있다 — 없으면 '-'로 둔다 (spec EventSummary)
        { label: '경품', value: event.prizeName ?? '-' },
        {
            label: '추첨 인원',
            value:
                event.winnerCount != null
                    ? event.winnerCount === 1
                        ? '단 1명'
                        : `${formatNumber(event.winnerCount)}명`
                    : '-',
        },
        {
            label: '응모 기간',
            value: `${formatYmd(event.startsAt)} ~ ${formatYmd(event.endsAt)} (${formatKst(event.endsAt, KST_HOUR_MINUTE)} 마감)`,
        },
        {
            label: '참여 방법',
            value:
                event.eventType === 'NO_TICKET'
                    ? '응모권 없이 한 번 참여'
                    : `응모권 ${event.requiredTickets}장으로 참여`,
        },
        { label: '참여 자격', value: MEMBERSHIP_NOTE[event.membershipRule] },
    ];

    return (
        <section className="bg-surface-sunken flex flex-col gap-6 rounded-2xl p-6 sm:p-8">
            <p className="text-subhead text-fg-primary">{event.description}</p>

            <dl className="flex flex-col gap-3">
                {specs.map(({ label, value }) => (
                    // 좁은 화면에서는 위아래로 쌓는다 — 라벨 칸을 넓게 잡으면 값 칸이 너무 좁아진다
                    <div key={label} className="flex flex-col sm:flex-row sm:items-start">
                        <dt className="text-body text-fg-tertiary sm:w-28 sm:shrink-0">{label}</dt>
                        <dd className="text-body text-fg-primary min-w-0 sm:flex-1">{value}</dd>
                    </div>
                ))}
            </dl>
        </section>
    );
}
