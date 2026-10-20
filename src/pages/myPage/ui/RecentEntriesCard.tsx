import { ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';

import type { MyEntryRow } from '@widgets/myEntryRows';

import { MyResultBadge } from '@entities/drawResult';
import { EventThumbnail } from '@entities/event';
import { Badge } from '@shared/ui/badge';
import { SkeletonList } from '@shared/ui/skeleton';
import { formatKstDot } from '@shared/utils/date';
import { formatNumber } from '@shared/utils/format';

import { SectionCard } from './SectionCard';

/** 미리보기 줄 수 — 나머지는 "전체 보기"(/my-entries)에서 본다 */
const PREVIEW_COUNT = 4;

/** 줄 보조 문구 — "09.17 · 겟또타임 · 응모권 1장 · 결과 발표 대기" (대기 표시는 결과 공개 전만) */
function metaOf({ entry, isTimeRaffle, result }: MyEntryRow) {
    const parts = [
        formatKstDot(entry.requestedAt),
        isTimeRaffle ? '겟또타임' : '이벤트',
        entry.deductedTicketCount === 0
            ? '응모권 없이 참여'
            : `응모권 ${formatNumber(entry.deductedTicketCount)}장`,
    ];
    if (result === 'PENDING') {
        parts.push('결과 발표 대기');
    }
    return parts.join(' · ');
}

/** 마이페이지 "응모 내역" — 최근 응모 4건. 줄 전체가 해당 이벤트·겟또타임 상세로 가는 링크다 */
export function RecentEntriesCard({
    rows,
    isPending,
    isError,
    isResultError = false,
}: {
    rows: MyEntryRow[];
    isPending: boolean;
    isError: boolean;
    /** 일부 응모의 본인 결과(E09)를 받지 못했는가 — 그 줄은 결과 칩 없이 보인다 */
    isResultError?: boolean;
}) {
    return (
        <SectionCard
            title="응모 내역"
            description="이벤트·겟또타임에 응모한 결과예요."
            moreTo="/my-entries"
            moreLabel="응모 내역 전체 보기"
        >
            {isPending && <SkeletonList />}
            {isError && (
                <p className="text-destructive text-body-sm">응모 내역을 불러오지 못했습니다.</p>
            )}
            {isResultError && (
                <p role="status" className="text-body-sm text-destructive">
                    일부 응모의 결과를 불러오지 못했어요.
                </p>
            )}
            {!isPending && !isError && rows.length === 0 && (
                <p className="text-body-sm text-fg-tertiary py-6 text-center">
                    아직 응모한 내역이 없어요.
                </p>
            )}
            {rows.length > 0 && (
                <ul className="divide-border-default flex flex-col divide-y">
                    {rows.slice(0, PREVIEW_COUNT).map((row) => (
                        <li key={row.entry.id} className="py-1 first:pt-0 last:pb-0">
                            <Link
                                to={row.to}
                                className="hover:bg-surface-canvas focus-visible:ring-border-focus -mx-3 flex items-center gap-4 rounded-xl px-3 py-3 transition-colors focus-visible:ring-2 focus-visible:outline-none"
                            >
                                <EventThumbnail src={row.event?.bannerImageUrl} />
                                <div className="flex min-w-0 flex-1 flex-col">
                                    <span className="text-body-bold text-fg-primary truncate">
                                        {row.entry.eventTitle}
                                    </span>
                                    <span className="text-body-sm text-fg-tertiary truncate">
                                        {metaOf(row)}
                                    </span>
                                </div>
                                {row.entry.status === 'REJECTED' ? (
                                    <Badge>접수 안 됨</Badge>
                                ) : (
                                    row.result && <MyResultBadge result={row.result} />
                                )}
                                <ChevronRight
                                    aria-hidden
                                    className="text-fg-secondary size-5 shrink-0"
                                />
                            </Link>
                        </li>
                    ))}
                </ul>
            )}
        </SectionCard>
    );
}
