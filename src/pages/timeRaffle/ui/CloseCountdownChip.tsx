import { Timer } from 'lucide-react';
import { useEffect, useState } from 'react';

import { useVirtualClock } from '@shared/model/virtualClock';
import { Badge } from '@shared/ui/badge';

import { formatCloseCountdown } from '../utils/raffleFormat';

/** 이 시간보다 적게 남으면 칩을 검게 채운다 — 곧 끝난다는 신호를 색으로 준다 */
const URGENT_MS = 10 * 60 * 1000;

/**
 * 마감까지 남은 시간 칩.
 *
 * 평소에는 글자만 두고, 10분 안쪽으로 들어오면 검은 칩으로 바꾼다. 늘 강조하면
 * 한 시간 남은 래플과 1분 남은 래플이 똑같이 급해 보인다.
 */
interface CloseCountdownChipProps {
    endsAt: string;
    /**
     * 대표 카드는 한 단계 크게, 작은 카드는 캡션 크기로 둔다 (시안 live-card / live-card · compact).
     * lg는 대표 카드 오른쪽 응모 칸의 큰 숫자 — 칩 대신 글자색으로 급함을 알린다
     */
    size?: 'lg' | 'md' | 'sm';
}

export function CloseCountdownChip({ endsAt, size = 'md' }: CloseCountdownChipProps) {
    const { now } = useVirtualClock();
    const [tick, setTick] = useState(() => now().getTime());

    useEffect(() => {
        const update = () => setTick(now().getTime());
        // 가상 시계를 옮기면 now가 새로 내려온다 — 다음 초를 기다리지 않고 바로 맞춘다
        update();
        const id = setInterval(update, 1000);
        return () => clearInterval(id);
    }, [now]);

    const remainingMs = new Date(endsAt).getTime() - tick;
    if (remainingMs <= 0) return null;

    const urgent = remainingMs <= URGENT_MS;

    if (size === 'lg') {
        return (
            <span
                aria-hidden
                className={`text-title-2 tabular-nums ${urgent ? 'text-fg-brand' : 'text-fg-primary'}`}
            >
                {formatCloseCountdown(remainingMs)}
            </span>
        );
    }

    const label = (
        <>
            <Timer className={size === 'md' ? 'size-3.5' : 'size-3'} />
            {formatCloseCountdown(remainingMs)} 남음
        </>
    );

    // 1초마다 바뀌는 값이라 읽어 주면 화면 낭독을 끊는다 — 남은 시간은 상세에서 다시 안내한다
    if (urgent) {
        // 검은 알약은 공용 Badge(inverse) — 같은 줄의 응모 칩(Badge sm)과 높이·여백이 같아야 크기가 달라 보이지 않는다
        return (
            <Badge
                aria-hidden
                variant="inverse"
                size={size === 'md' ? 'md' : 'sm'}
                className={`gap-1 font-semibold tabular-nums ${size === 'md' ? 'text-sm' : ''}`}
            >
                {label}
            </Badge>
        );
    }

    const text = size === 'md' ? 'text-body-sm' : 'text-caption';
    return (
        <span
            aria-hidden
            className={`${text} text-fg-secondary flex items-center gap-1 tabular-nums`}
        >
            {label}
        </span>
    );
}
