import { Minus, Plus } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';

import { useVirtualClock } from '@shared/model/virtualClock';
import { Button } from '@shared/ui/button';
import { cn } from '@shared/utils/cn';
import { KST_TIME_ZONE } from '@shared/utils/date';

const HOUR_MS = 3_600_000;
// 시연 조작 단위는 10분 — 가상 시계 페이지의 "앞으로 이동"과 같은 간격 정책
const MINUTE_STEP_MS = 10 * 60_000;

// 시·분·초를 각각 다른 스타일로 그리기 위해 파트별 포맷이 필요하다 — timeZone은 date.ts의 상수만 쓴다
const TIME_FORMATTER = new Intl.DateTimeFormat('ko-KR', {
    timeZone: KST_TIME_ZONE,
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
});

export function VirtualClockTicker({
    className,
    readOnly = false,
}: {
    className?: string;
    /** true면 ± 버튼 없이 시각만 표시한다 (일반 사용자 헤더용) */
    readOnly?: boolean;
}) {
    const { now, setOverride, isOverridden } = useVirtualClock();
    // 오버라이드가 없을 때 표시 시각을 실시간으로 갱신한다
    const [, setTick] = useState(0);

    useEffect(() => {
        const id = setInterval(() => setTick((t) => t + 1), 1000);
        return () => clearInterval(id);
    }, []);

    const parts = TIME_FORMATTER.formatToParts(now());
    const part = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
    const shift = (deltaMs: number) => setOverride(new Date(now().getTime() + deltaMs));

    return (
        <div
            className={cn(
                'border-border bg-surface-elevated text-body-sm flex items-center gap-0.5 rounded-full border px-2 py-0.5 whitespace-nowrap',
                isOverridden && 'border-brand-primary/40',
                className,
            )}
            role="timer"
            aria-label={`표시 시각 ${part('dayPeriod')} ${part('hour')}:${part('minute')}:${part('second')}`}
            title={readOnly ? '가상 시계' : '가상 시계 — 시간/분을 직접 조작할 수 있습니다'}
        >
            <span
                className={cn(
                    'px-1',
                    isOverridden ? 'text-fg-brand font-medium' : 'text-fg-tertiary',
                )}
            >
                {part('dayPeriod')}
            </span>
            {!readOnly && (
                <StepButton label="1시간 빼기" onClick={() => shift(-HOUR_MS)}>
                    <Minus />
                </StepButton>
            )}
            <span
                className={cn(
                    // 숫자 칸은 글자 2개 폭(2ch)·고정폭 숫자로 — 한 자리 시(4)도 콜론에 붙어 간격이 고르고, 초가 바뀌어도 흔들리지 않는다
                    'w-[2ch] text-right tabular-nums',
                    isOverridden && 'text-fg-brand font-medium',
                )}
            >
                {part('hour')}
            </span>
            {!readOnly && (
                <StepButton label="1시간 더하기" onClick={() => shift(HOUR_MS)}>
                    <Plus />
                </StepButton>
            )}
            <span className="text-fg-tertiary">:</span>
            {!readOnly && (
                <StepButton label="10분 빼기" onClick={() => shift(-MINUTE_STEP_MS)}>
                    <Minus />
                </StepButton>
            )}
            <span
                className={cn('w-[2ch] tabular-nums', isOverridden && 'text-fg-brand font-medium')}
            >
                {part('minute')}
            </span>
            {!readOnly && (
                <StepButton label="10분 더하기" onClick={() => shift(MINUTE_STEP_MS)}>
                    <Plus />
                </StepButton>
            )}
            <span className="text-fg-tertiary">:</span>
            <span className="text-fg-tertiary w-[2ch] tabular-nums">{part('second')}</span>
        </div>
    );
}

function StepButton({
    label,
    onClick,
    children,
}: {
    label: string;
    onClick: () => void;
    children: ReactNode;
}) {
    return (
        <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            aria-label={label}
            onClick={onClick}
            className="rounded-full"
        >
            {children}
        </Button>
    );
}
