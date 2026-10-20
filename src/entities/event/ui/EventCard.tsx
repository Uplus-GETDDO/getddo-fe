import { useState } from 'react';

import { useImageFallback } from '@shared/hooks/useImageFallback';
import { useVirtualClock } from '@shared/model/virtualClock';
import { Badge } from '@shared/ui/badge';
import { Card } from '@shared/ui/card';
import { toKst } from '@shared/utils/date';

import type { Event } from '../model/types';

const DAY_MS = 24 * 60 * 60 * 1000;

// 카드 표시용 "2026-09-01" 형태
function formatYmd(date: string): string {
    const d = toKst(date);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

// KST 달력 날짜 기준 D-day (마감 당일 = D-0)
function kstDayDiff(endIso: string, now: Date): number {
    const end = toKst(endIso);
    const n = toKst(now);
    const endDay = Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate());
    const nowDay = Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate());
    return Math.round((endDay - nowDay) / DAY_MS);
}

export function EventCard({ event }: { event: Event }) {
    const banner = useImageFallback(event.bannerImageUrl);
    // 마감 판정이 아닌 D-day 표시 전용이므로 마운트 시각을 쓴다
    const clock = useVirtualClock();
    const [now] = useState(() => clock.now());
    const dDay = event.status === 'open' ? kstDayDiff(event.endsAt, now) : null;

    return (
        // 홈 이벤트 카드 — 테두리 + 그림자, 이미지 16:9, 본문 여백 16.
        // 피그마는 테두리 없이 그림자만이지만, 흰 배경 사진이면 카드 윤곽이 흐려지고 같은 홈의 겟또타임·응모권 카드와 꼴이 달라 테두리를 준다
        <Card className="h-full gap-0 py-0">
            {banner.shown ? (
                // 이벤트 배너는 16:9로 채운다(DESIGN-SYSTEM '이미지 비율') — 그림 스타일이 달라도 같은 틀로 보이게 비율·자르기 기준을 고정하고, 밝은 그림이 본문과 붙어 보이지 않게 아래 구분선을 둔다
                <img
                    src={event.bannerImageUrl!}
                    alt=""
                    onError={banner.onError}
                    className="border-border-default aspect-video w-full shrink-0 border-b object-cover object-center"
                />
            ) : (
                <div className="bg-surface-sunken aspect-video" />
            )}
            <div className="flex flex-col gap-3 p-4">
                {dDay != null && dDay >= 0 && (
                    <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="inverse">D-{dDay}</Badge>
                    </div>
                )}
                <div className="flex flex-col gap-2">
                    <p className="text-body-bold text-fg-primary truncate">{event.title}</p>
                    <p className="text-body-sm text-fg-tertiary">
                        {formatYmd(event.startsAt)} ~ {formatYmd(event.endsAt)}
                    </p>
                </div>
            </div>
        </Card>
    );
}
