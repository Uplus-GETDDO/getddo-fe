import type { ReactNode } from 'react';

import { TriangleAlert } from 'lucide-react';
import { useId } from 'react';

import { Button } from '@shared/ui/button';
import { cn } from '@shared/utils/cn';

/**
 * 대시보드 칸 — 운영 현황 카드(여백 20)에 제목·설명·오른쪽 동작을 둔다.
 * 조회 실패는 칸 안에서 다시 시도로 복구한다
 */
export function DashboardPanel({
    title,
    caption,
    actions,
    error,
    hasData = false,
    onRetry,
    className,
    children,
}: {
    title: string;
    caption?: ReactNode;
    actions?: ReactNode;
    error?: boolean;
    /** 이전에 받은 데이터가 있는가 — 있으면 다시 받기에 실패해도 내용을 그대로 둔다 */
    hasData?: boolean;
    onRetry?: () => void;
    className?: string;
    children: ReactNode;
}) {
    const titleId = useId();
    const staleError = Boolean(error && hasData);
    return (
        <section
            aria-labelledby={titleId}
            className={cn(
                'bg-surface-page border-border-default flex min-w-0 flex-col gap-4 rounded-2xl border p-5',
                className,
            )}
        >
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex flex-col gap-0.5">
                    <h2 id={titleId} className="text-body-bold text-fg-primary">
                        {title}
                    </h2>
                    {caption && <p className="text-caption text-fg-tertiary">{caption}</p>}
                </div>
                {(staleError || actions) && (
                    <div className="flex items-center gap-1">
                        {/* 다시 받기에 실패했지만 이전 내용이 있으면 내용은 두고 작게 알린다 */}
                        {staleError && (
                            <button
                                type="button"
                                onClick={onRetry}
                                className="text-caption text-semantic-error-strong hover:bg-surface-sunken focus-visible:ring-border-focus inline-flex h-8 items-center gap-1 rounded-full px-2.5 focus-visible:ring-2 focus-visible:outline-none"
                            >
                                <TriangleAlert aria-hidden className="size-3.5" />
                                갱신 실패 · 다시 시도
                            </button>
                        )}
                        {actions}
                    </div>
                )}
            </div>
            {error && !hasData ? (
                <div className="flex items-center gap-3" role="alert">
                    <p className="text-semantic-error-strong text-body-sm">
                        정보를 불러오지 못했습니다.
                    </p>
                    {onRetry && (
                        <Button size="sm" variant="secondary" onClick={onRetry}>
                            다시 시도
                        </Button>
                    )}
                </div>
            ) : (
                children
            )}
        </section>
    );
}
