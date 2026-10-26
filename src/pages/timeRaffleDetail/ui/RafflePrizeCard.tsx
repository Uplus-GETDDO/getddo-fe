import type { Event, EventPrize } from '@entities/event';

import { useImageFallback } from '@shared/hooks/useImageFallback';
import { ImagePlaceholder } from '@shared/ui/image-placeholder';
import { formatNumber } from '@shared/utils/format';

/**
 * 등수별 경품 — 관리자가 올린 경품 그림을 보이는 유일한 자리다.
 *
 * 상세(E02)에만 실리는 값이라 목록에서 들어온 뒤 상세가 도착하기 전에는 비어 있다.
 * 경품이 없는 이벤트도 있어, 페이지가 비었을 때는 이 카드를 아예 그리지 않는다.
 */
export function RafflePrizeCard({ event }: { event: Event }) {
    const prizes = event.prizes;
    if (!prizes?.length) return null;

    return (
        <section className="bg-surface-page border-border-default flex flex-col gap-6 rounded-2xl border p-5">
            <div className="flex flex-wrap items-baseline gap-3">
                <h2 className="text-subhead text-fg-primary">경품</h2>
                {/* 등수가 여럿이면 몇 종인지 먼저 알려 준다 — 아래 목록을 세지 않아도 되게 */}
                {prizes.length > 1 && (
                    <span className="text-caption text-fg-tertiary">{prizes.length}종</span>
                )}
            </div>

            <ul className="flex flex-col gap-4">
                {prizes.map((prize) => (
                    <li key={prize.id}>
                        <PrizeRow prize={prize} showRank={prizes.length > 1} />
                    </li>
                ))}
            </ul>
        </section>
    );
}

function PrizeRow({ prize, showRank }: { prize: EventPrize; showRank: boolean }) {
    const image = useImageFallback(prize.imageUrl);

    return (
        <div className="flex items-start gap-4">
            {/*
             * 경품 사진은 비율이 제각각이라 정사각 칸에 맞춰 자른다 — 칸 크기가 같아야 등수끼리 비교가 된다.
             * 올리지 않았거나 주소가 깨진 경품은 같은 크기의 빈 칸을 둬 줄이 흐트러지지 않게 한다.
             */}
            <div className="bg-surface-sunken relative size-20 shrink-0 overflow-hidden rounded-xl">
                {image.shown ? (
                    <img
                        src={prize.imageUrl!}
                        alt=""
                        onError={image.onError}
                        className="absolute inset-0 size-full object-cover"
                    />
                ) : (
                    <ImagePlaceholder className="size-full" />
                )}
            </div>

            <div className="flex min-w-0 flex-1 flex-col gap-1">
                <div className="flex flex-wrap items-baseline gap-2">
                    {/* 경품이 하나뿐이면 '1등'이 오히려 군더더기라 이름만 둔다 */}
                    {showRank && (
                        <span className="text-body-sm-bold text-fg-tertiary">{prize.rank}등</span>
                    )}
                    <p className="text-body-bold text-fg-primary">{prize.name}</p>
                </div>
                <p className="text-body-sm text-fg-secondary">
                    {prize.winnerCount === 1 ? '단 1명' : `${formatNumber(prize.winnerCount)}명`}
                </p>
                {prize.description && (
                    <p className="text-body-sm text-fg-tertiary">{prize.description}</p>
                )}
            </div>
        </div>
    );
}
