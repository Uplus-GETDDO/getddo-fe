import { useState } from 'react';

import { cn } from '@shared/utils/cn';

const STEP_BUTTON =
    'border-border-strong text-body-bold flex size-8 items-center justify-center rounded-lg border disabled:cursor-not-allowed';

interface QuantityStepperProps {
    value: number;
    min: number;
    max: number;
    onChange: (next: number) => void;
    /** 스크린 리더에 읽히는 수량 이름 — 등급별 선택에서는 '브론즈 응모 수량'처럼 구체적으로 넘긴다 */
    label?: string;
}

/**
 * 응모 수량 조절 — 보유 응모권과 1인 한도 안에서만 오르내린다.
 * 가운데 숫자는 직접 입력할 수도 있다. 숫자만 받고, 범위를 넘으면 최댓값·최솟값으로 맞춘다.
 * 입력 중에 칸을 비워도 되고, 칸을 벗어날 때 비어 있으면 최솟값으로 돌린다
 */
export function QuantityStepper({
    value,
    min,
    max,
    onChange,
    label = '응모 수량',
}: QuantityStepperProps) {
    // 입력 중인 글자 — 지우는 도중의 빈 칸을 0으로 바꾸지 않으려고 따로 둔다. null이면 value를 그대로 보여 준다
    const [draft, setDraft] = useState<string | null>(null);
    const clamp = (n: number) => Math.min(max, Math.max(min, n));

    return (
        <div className="flex items-center gap-3">
            <button
                type="button"
                aria-label={`${label} 줄이기`}
                disabled={value <= min}
                onClick={() => onChange(value - 1)}
                className={cn(STEP_BUTTON, value <= min ? 'text-fg-disabled' : 'text-fg-primary')}
            >
                −
            </button>
            <input
                type="text"
                inputMode="numeric"
                aria-label={label}
                value={draft ?? String(value)}
                onFocus={(event) => event.currentTarget.select()}
                onChange={(event) => {
                    const digits = event.target.value.replace(/\D/g, '');
                    if (digits === '') {
                        setDraft('');
                        return;
                    }
                    const next = clamp(Number(digits));
                    setDraft(String(next));
                    onChange(next);
                }}
                onBlur={() => {
                    if (draft === '') onChange(clamp(min));
                    setDraft(null);
                }}
                className="text-body-bold text-fg-primary border-border-default focus-visible:border-border-focus h-8 w-12 rounded-lg border text-center tabular-nums outline-none"
            />
            <button
                type="button"
                aria-label={`${label} 늘리기`}
                disabled={value >= max}
                onClick={() => onChange(value + 1)}
                className={cn(STEP_BUTTON, value >= max ? 'text-fg-disabled' : 'text-fg-primary')}
            >
                +
            </button>
        </div>
    );
}
