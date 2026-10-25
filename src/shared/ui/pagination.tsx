import { cn } from 'cn';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useState } from 'react';

import { pageItems } from '@shared/utils/pagination';

const CELL =
    'text-body-sm focus-visible:ring-border-focus flex size-9 shrink-0 items-center justify-center rounded-lg tabular-nums transition-colors focus-visible:ring-2 focus-visible:outline-none';

/**
 * 관리자 표 번호형 페이지네이션 — `< 1 2 3 4 … 10 >` (ADR-0009). 사용자 화면의 원형 화살표 Pager와 다르게
 * 원하는 쪽으로 바로 뛸 수 있다. page는 1부터, 현재 쪽은 진한 바탕으로 칠한다
 */
function Pagination({
    page,
    totalPages,
    onPageChange,
    label = '페이지',
    jump = false,
    className,
}: {
    page: number;
    totalPages: number;
    onPageChange: (page: number) => void;
    /** 한 화면에 목록이 여럿이면 어느 목록의 쪽 넘김인지 구분해 읽힌다 — 예: '응모 내역 페이지' */
    label?: string;
    /** 쪽 번호를 직접 입력해 이동 — 수천 건 관리자 목록처럼 쪽이 많아 번호 버튼만으로 멀리 가기 어려울 때 */
    jump?: boolean;
    className?: string;
}) {
    const arrow = cn(
        CELL,
        'text-fg-secondary hover:bg-surface-sunken disabled:text-fg-disabled disabled:cursor-not-allowed disabled:hover:bg-transparent',
    );
    return (
        // 쪽 수가 많으면 번호 줄이 320px 화면을 밀어낸다 — 좁은 부모 안에서는 줄이 안쪽으로 스크롤한다
        <nav
            aria-label={label}
            className={cn('flex max-w-full items-center gap-1 overflow-x-auto', className)}
        >
            <button
                type="button"
                aria-label="이전 페이지"
                disabled={page <= 1}
                onClick={() => onPageChange(page - 1)}
                className={arrow}
            >
                <ChevronLeft aria-hidden className="size-4" />
            </button>
            {pageItems(page, totalPages).map((item) =>
                typeof item === 'number' ? (
                    <button
                        key={item}
                        type="button"
                        aria-label={`${item}페이지`}
                        aria-current={item === page ? 'page' : undefined}
                        onClick={() => onPageChange(item)}
                        className={cn(
                            CELL,
                            item === page
                                ? 'bg-surface-inverse text-fg-inverse font-semibold'
                                : 'text-fg-secondary hover:bg-surface-sunken hover:text-fg-primary',
                        )}
                    >
                        {item}
                    </button>
                ) : (
                    <span key={item} aria-hidden className={cn(CELL, 'text-fg-tertiary')}>
                        …
                    </span>
                ),
            )}
            <button
                type="button"
                aria-label="다음 페이지"
                disabled={page >= totalPages}
                onClick={() => onPageChange(page + 1)}
                className={arrow}
            >
                <ChevronRight aria-hidden className="size-4" />
            </button>
            {jump && totalPages > 1 && (
                <PageJump page={page} totalPages={totalPages} onPageChange={onPageChange} />
            )}
        </nav>
    );
}

/**
 * 쪽 번호 입력 — `[ 3 / 120 | 이동 ]`을 테두리 하나로 묶어 번호 줄 옆에 붙은 한 덩어리로 보이게 한다.
 * 범위를 넘으면 처음·마지막 쪽으로 맞춘다. 엔터나 '이동'으로 확정한다
 */
function PageJump({
    page,
    totalPages,
    onPageChange,
}: {
    page: number;
    totalPages: number;
    onPageChange: (page: number) => void;
}) {
    const [value, setValue] = useState('');
    return (
        <form
            className="border-border-input bg-surface-page focus-within:border-border-focus ml-3 flex h-9 shrink-0 items-center overflow-hidden rounded-lg border transition-colors"
            onSubmit={(event) => {
                event.preventDefault();
                const next = Number.parseInt(value, 10);
                if (Number.isNaN(next)) return;
                const clamped = Math.min(Math.max(1, next), totalPages);
                setValue('');
                if (clamped !== page) onPageChange(clamped);
            }}
        >
            <input
                inputMode="numeric"
                pattern="[0-9]*"
                aria-label={`이동할 페이지 (1~${totalPages})`}
                placeholder={String(page)}
                value={value}
                onChange={(event) => setValue(event.target.value.replace(/\D/g, ''))}
                className="text-body-sm text-fg-primary placeholder:text-fg-tertiary h-full w-12 bg-transparent text-right tabular-nums outline-none"
            />
            <span className="text-body-sm text-fg-tertiary pr-3 pl-1 tabular-nums">
                / {totalPages}
            </span>
            <button
                type="submit"
                className="text-body-sm-bold text-fg-primary hover:bg-surface-sunken border-border-default h-full cursor-pointer border-l px-3 transition-colors focus-visible:outline-none"
            >
                이동
            </button>
        </form>
    );
}

export { Pagination };
