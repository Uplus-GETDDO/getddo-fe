import { cn } from 'cn';
import { CircleArrowLeft, CircleArrowRight } from 'lucide-react';
import * as React from 'react';

const ARROW =
    'text-fg-primary hover:text-fg-secondary focus-visible:ring-border-focus focus-visible:ring-offset-2 focus-visible:ring-offset-surface-page disabled:text-fg-disabled flex shrink-0 cursor-pointer items-center justify-center rounded-full focus-visible:ring-2 focus-visible:outline-none disabled:cursor-not-allowed';

// 피그마 홈 — 원형 화살표(lucide CircleArrow) 사이에 '01 / 04' (글자 12 Medium)
const SIZES = {
    // 메인 배너 넘김 — 화살표 30
    lg: 'size-7.5',
    // 섹션 안 넘김(오픈 예정 등) — 화살표 20, 배너보다 작게
    md: 'size-5',
} as const;

// 그림 크기와 별개로 누름 칸은 WCAG 2.5.8 최소 24px를 지킨다 — md는 아이콘 20에 칸을 24로 잡는다
const HIT_SIZES = { lg: '', md: 'size-6' } as const;

/**
 * 페이지 넘김 화살표. size로 위계를 나눈다 — lg는 메인 배너, md는 섹션 안 목록(오픈 예정 등).
 * current는 0부터. 끝에서 멈추는 목록은 prev/nextDisabled로 화살표를 흐리게 막는다.
 * children은 오른쪽 끝에 덧붙인다
 */
function Pager({
    current,
    total,
    onPrev,
    onNext,
    size = 'lg',
    prevDisabled = false,
    nextDisabled = false,
    prevLabel = '이전',
    nextLabel = '다음',
    className,
    children,
}: {
    current: number;
    total: number;
    onPrev: () => void;
    onNext: () => void;
    size?: keyof typeof SIZES;
    prevDisabled?: boolean;
    nextDisabled?: boolean;
    prevLabel?: string;
    nextLabel?: string;
    className?: string;
    children?: React.ReactNode;
}) {
    const icon = SIZES[size];
    const hit = HIT_SIZES[size];
    const pad = (n: number) => String(n).padStart(2, '0');
    return (
        <div data-slot="pager" className={cn('flex items-center gap-2', className)}>
            <button
                type="button"
                aria-label={prevLabel}
                disabled={prevDisabled}
                onClick={onPrev}
                className={cn(ARROW, hit)}
            >
                <CircleArrowLeft className={icon} strokeWidth={1.5} />
            </button>
            {/* 글자 크기는 text-xs로 둔다 — 커스텀 타이포 토큰은 공용 cn이 글자색과 같은 묶음으로 보고 색을 지운다 */}
            <span className="text-fg-primary text-xs leading-[1.125rem] font-medium tabular-nums">
                {pad(current + 1)} / {pad(total)}
            </span>
            <button
                type="button"
                aria-label={nextLabel}
                disabled={nextDisabled}
                onClick={onNext}
                className={cn(ARROW, hit)}
            >
                <CircleArrowRight className={icon} strokeWidth={1.5} />
            </button>
            {children}
        </div>
    );
}

export { Pager };
