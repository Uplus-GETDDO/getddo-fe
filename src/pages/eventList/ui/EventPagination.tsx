import { ChevronLeft, ChevronRight } from 'lucide-react';

import { cn } from '@shared/utils/cn';

export function EventPagination({
    page,
    totalPages,
    onPageChange,
}: {
    page: number;
    totalPages: number;
    onPageChange: (page: number) => void;
}) {
    const pages = Array.from({ length: totalPages }, (_, i) => i + 1);

    return (
        <nav aria-label="페이지" className="flex items-center justify-center gap-2">
            <button
                type="button"
                aria-label="이전 페이지"
                disabled={page <= 1}
                onClick={() => onPageChange(page - 1)}
                className="text-fg-tertiary enabled:hover:bg-surface-sunken focus-visible:ring-border-focus focus-visible:ring-offset-surface-page rounded-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:opacity-50"
            >
                <ChevronLeft className="size-5" />
            </button>
            {pages.map((p) => (
                <button
                    key={p}
                    type="button"
                    aria-current={p === page ? 'page' : undefined}
                    onClick={() => onPageChange(p)}
                    className={cn(
                        'text-body-sm-bold focus-visible:ring-border-focus focus-visible:ring-offset-surface-page rounded-sm px-3 py-2 leading-4 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none',
                        p === page
                            ? 'bg-surface-canvas text-fg-primary'
                            : 'text-fg-tertiary hover:bg-surface-sunken',
                    )}
                >
                    {p}
                </button>
            ))}
            <button
                type="button"
                aria-label="다음 페이지"
                disabled={page >= totalPages}
                onClick={() => onPageChange(page + 1)}
                className="text-fg-tertiary enabled:hover:bg-surface-sunken focus-visible:ring-border-focus focus-visible:ring-offset-surface-page rounded-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:opacity-50"
            >
                <ChevronRight className="size-5" />
            </button>
        </nav>
    );
}
