import type { ReactNode } from 'react';

import { useId } from 'react';

import { Button } from '@shared/ui/button';
import { cn } from '@shared/utils/cn';

/**
 * 대시보드 칸 — 흰 판(여백 24, 1px 선, 그림자 없음)에 제목·설명·오른쪽 동작을 둔다.
 * tone="inverse"는 먹색 판 — 화면에서 가장 먼저 봐야 할 칸(지금 처리할 일) 하나에만 쓴다.
 * 조회 실패는 칸 안에서 다시 시도로 복구한다
 */
export function DashboardPanel({
    title,
    caption,
    actions,
    error,
    onRetry,
    tone = 'default',
    className,
    children,
}: {
    title: string;
    caption?: ReactNode;
    actions?: ReactNode;
    error?: boolean;
    onRetry?: () => void;
    tone?: 'default' | 'inverse';
    className?: string;
    children: ReactNode;
}) {
    const titleId = useId();
    return (
        <section
            aria-labelledby={titleId}
            className={cn(
                'flex min-w-0 flex-col gap-5 rounded-2xl p-6',
                tone === 'inverse'
                    ? 'bg-surface-inverse text-fg-inverse'
                    : 'bg-surface-page border-border-default border',
                className,
            )}
        >
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex flex-col gap-0.5">
                    <h2
                        id={titleId}
                        className={
                            tone === 'inverse'
                                ? 'text-fg-inverse text-base font-semibold'
                                : 'text-fg-primary text-base font-semibold'
                        }
                    >
                        {title}
                    </h2>
                    {caption && (
                        <p
                            className={
                                tone === 'inverse'
                                    ? 'text-caption text-fg-inverse/65'
                                    : 'text-caption text-fg-tertiary'
                            }
                        >
                            {caption}
                        </p>
                    )}
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
