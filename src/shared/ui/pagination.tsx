import { cn } from 'cn';
import { ChevronLeft, ChevronRight } from 'lucide-react';

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
    className,
}: {
    page: number;
    totalPages: number;
    onPageChange: (page: number) => void;
    className?: string;
}) {
    const arrow = cn(
        CELL,
        'text-fg-secondary hover:bg-surface-sunken disabled:text-fg-disabled disabled:cursor-not-allowed disabled:hover:bg-transparent',
    );
    return (
        <nav aria-label="페이지" className={cn('flex items-center gap-1', className)}>
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
        </nav>
    );
}

export { Pagination };
