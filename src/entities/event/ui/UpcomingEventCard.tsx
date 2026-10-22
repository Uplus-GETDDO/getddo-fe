import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import { useVirtualClock } from '@shared/model/virtualClock';
import { StatusDot } from '@shared/ui/status-dot';
import { formatKst, kstDayDiff } from '@shared/utils/date';
import { formatNumber } from '@shared/utils/format';

import type { Event } from '../model/types';

import { eventDetailPath } from '../utils/eventPath';
import { EventThumbnail } from './EventThumbnail';

const TIME_ONLY: Intl.DateTimeFormatOptions = {
    hour: 'numeric',
    minute: '2-digit',
    hour12: false,
};

/** 이 시간 안에 열리면 겟또타임 카드처럼 '곧 오픈'을 브랜드색으로 적는다 — "지금" 신호는 곧 열리는 것에만 쓴다 (DESIGN-SYSTEM 13절) */
const SOON_MS = 30 * 60 * 1000;
const SOON_CHECK_MS = 30 * 1000;

const MONTH_DAY: Intl.DateTimeFormatOptions = { month: 'numeric', day: 'numeric' };

/** 오픈 날 — 오늘·내일, 그 뒤는 날짜. 목록에 다음 날 래플이 섞여도 '오늘'로 적지 않는다 */
function openDayLabel(startsAt: string, now: Date): string {
    const diff = kstDayDiff(startsAt, now);
    if (diff <= 0) return '오늘';
    if (diff === 1) return '내일';
    return formatKst(startsAt, MONTH_DAY);
}

/** 오픈 예정 이벤트 행 — 컨테이너 카드 안에 여러 개가 쌓이는 형태라 자체 카드 테두리는 두지 않는다 */
export function UpcomingEventCard({ event }: { event: Event }) {
    const { now } = useVirtualClock();
    // 카드를 띄워 둔 채 30분 안으로 들어와도 '곧 오픈'으로 바뀌게 주기적으로 다시 잰다 — 문구만 바뀌니 30초면 충분하다
    const [tick, setTick] = useState(() => now().getTime());
    useEffect(() => {
        const update = () => setTick(now().getTime());
        update();
        const id = setInterval(update, SOON_CHECK_MS);
        return () => clearInterval(id);
    }, [now]);
    const untilOpen = new Date(event.startsAt).getTime() - tick;
    const soon = untilOpen > 0 && untilOpen <= SOON_MS;
    const time = formatKst(event.startsAt, TIME_ONLY);

    return (
        <Link
            to={eventDetailPath(event)}
            // 넘김 영역이 overflow-hidden이라 바깥에 띄운 포커스 링은 잘린다 — 이 행은 링을 안쪽(ring-inset)에 그린다
            // 발표 결과 행과 같은 호버 — 행에서 8px 들인 옅은 배경. 글이 세 줄이라 위아래는 12px로 조금 더 띄워 호버 배경에 글이 붙어 보이지 않게 한다
            className="focus-visible:ring-border-focus after:bg-surface-canvas/60 relative isolate flex min-h-0 items-center gap-4 rounded-2xl px-4 py-5 after:absolute after:inset-2 after:-z-10 after:rounded-xl after:opacity-0 hover:after:opacity-100 focus-visible:ring-2 focus-visible:outline-none focus-visible:ring-inset motion-safe:after:transition-opacity motion-safe:after:duration-200"
        >
            {/* 겟또타임 래플이라 상품 그림 — 1:1로 잘리지 않게 맞춘다 */}
            <EventThumbnail src={event.bannerImageUrl} className="size-16" />
            <div className="flex min-w-0 flex-col gap-1">
                {/* 색 점만으로는 왜 하나만 다른지 알 수 없어 '곧 오픈'을 글자로 적고, 나머지는 회색 예정 안내로 둔다 */}
                {soon ? (
                    <StatusDot tone="brand">{time} 곧 오픈</StatusDot>
                ) : (
                    <StatusDot tone="muted">
                        {openDayLabel(event.startsAt, new Date(tick))} {time} 오픈 예정
                    </StatusDot>
                )}
                <p className="text-body-bold text-fg-primary truncate">{event.title}</p>
                {/* 당첨 인원은 제목 옆 괄호 대신 아랫줄에 — 괄호만으로는 무슨 인원인지 헷갈렸다. 목록 응답에는 prizes가 없어 인원이 비면 문구를 뺀다 */}
                <p className="text-caption text-fg-tertiary">
                    {event.winnerCount != null && `당첨 ${formatNumber(event.winnerCount)}명 · `}
                    응모권 {formatNumber(event.requiredTickets)}장부터 응모
                </p>
            </div>
        </Link>
    );
}
