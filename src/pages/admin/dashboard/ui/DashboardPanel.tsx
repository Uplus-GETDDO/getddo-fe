import type { ReactNode } from 'react';

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
    onRetry,
    className,
    children,
}: {
    title: string;
    caption?: ReactNode;
    actions?: ReactNode;
    error?: boolean;
    onRetry?: () => void;
    className?: string;
    children: ReactNode;
}) {
    const titleId = useId();
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
                {actions && <div className="flex items-center gap-1">{actions}</div>}
            </div>
            {error ? (
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
