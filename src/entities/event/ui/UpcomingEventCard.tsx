import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import { useVirtualClock } from '@shared/model/virtualClock';
import { StatusDot } from '@shared/ui/status-dot';
import { formatKst } from '@shared/utils/date';
import { formatNumber } from '@shared/utils/format';

import type { Event } from '../model/types';

import { eventDetailPath } from '../utils/eventPath';
import { EventThumbnail } from './EventThumbnail';

const TIME_ONLY: Intl.DateTimeFormatOptions = {
    hour: 'numeric',
    minute: '2-digit',
    hour12: false,
};

/** 이 시간 안에 열리면 마젠타 점 — "지금" 신호는 곧 열리는 것에만 쓴다 (DESIGN-SYSTEM 13절) */
const SOON_MS = 30 * 60 * 1000;
const SOON_CHECK_MS = 30 * 1000;

/** 오픈 예정 이벤트 행 — 컨테이너 카드 안에 여러 개가 쌓이는 형태라 자체 카드 테두리는 두지 않는다 */
export function UpcomingEventCard({ event }: { event: Event }) {
    const { now } = useVirtualClock();
    // 카드를 띄워 둔 채 30분 안으로 들어와도 점이 바뀌게 주기적으로 다시 잰다 — 점 색만 바뀌니 30초면 충분하다
    const [tick, setTick] = useState(() => now().getTime());
    useEffect(() => {
        const update = () => setTick(now().getTime());
        update();
        const id = setInterval(update, SOON_CHECK_MS);
        return () => clearInterval(id);
    }, [now]);
    const untilOpen = new Date(event.startsAt).getTime() - tick;
    const soon = untilOpen > 0 && untilOpen <= SOON_MS;

    return (
        <Link
            to={eventDetailPath(event)}
            // 넘김 영역이 overflow-hidden이라 바깥에 띄운 포커스 링은 잘린다 — 이 행은 링을 안쪽(ring-inset)에 그린다
            // 발표 결과 행과 같은 호버 — 행에서 8px 들인 옅은 배경, 안쪽 여백도 8px로 사방 같게
            className="focus-visible:ring-border-focus after:bg-surface-canvas/60 relative isolate flex min-h-0 items-center gap-4 rounded-2xl p-4 after:absolute after:inset-2 after:-z-10 after:rounded-xl after:opacity-0 hover:after:opacity-100 focus-visible:ring-2 focus-visible:outline-none focus-visible:ring-inset motion-safe:after:transition-opacity motion-safe:after:duration-200"
        >
            {/* 겟또타임 래플이라 상품 그림 — 1:1로 잘리지 않게 맞춘다 */}
            <EventThumbnail src={event.bannerImageUrl} className="size-16" />
            <div className="flex min-w-0 flex-col gap-1">
                <StatusDot tone={soon ? 'info' : 'muted'}>
                    오늘 {formatKst(event.startsAt, TIME_ONLY)} 오픈 예정
                </StatusDot>
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
