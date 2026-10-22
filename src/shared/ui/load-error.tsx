import { Button } from '@shared/ui/button';
import { EmptyState } from '@shared/ui/empty-state';
import { cn } from '@shared/utils/cn';

/**
 * 처음부터 받지 못했을 때의 칸 — 빈 상태 그림과 짧은 안내, '다시 시도'.
 * 빨간 한 줄('…불러오지 못했습니다') 대신 쓴다. 받아 둔 내용이 있으면 이 칸을 띄우지 말고 내용을 그대로 둔 채
 * 작은 갱신 표시(RefreshStatus)로만 알린다 — 다시 받기 실패로 화면이 비면 안 된다.
 * inline은 한 줄 띠 — 홈처럼 여러 섹션이 이어지는 화면에서 큰 빈 칸이 고장 난 것처럼 보이지 않게 쓴다
 */
function LoadError({
    title,
    onRetry,
    retrying = false,
    size = 'sm',
    inline = false,
    className,
}: {
    /** 무엇을 못 받았는지 — 예: '겟또타임을 불러오지 못했어요' */
    title: string;
    onRetry?: () => void;
    /** 다시 받는 중이면 버튼을 잠근다 */
    retrying?: boolean;
    size?: 'sm' | 'md';
    /** 그림 없이 문구와 '다시 시도'만 한 줄로 */
    inline?: boolean;
    className?: string;
}) {
    if (inline) {
        return (
            <div
                role="alert"
                className={cn(
                    'border-border-default flex flex-wrap items-center justify-between gap-3 rounded-2xl border px-5 py-4',
                    className,
                )}
            >
                <p className="text-body-sm text-fg-secondary">
                    {title}. 잠시 후 다시 시도해 주세요.
                </p>
                {onRetry && (
                    <Button variant="secondary" size="sm" disabled={retrying} onClick={onRetry}>
                        다시 시도
                    </Button>
                )}
            </div>
        );
    }
    return (
        <div role="alert" className={cn('flex w-full', className)}>
            <EmptyState
                size={size}
                title={title}
                description="잠시 후 다시 시도해 주세요."
                className="flex-1"
                action={
                    onRetry && (
                        <Button variant="secondary" size="sm" disabled={retrying} onClick={onRetry}>
                            다시 시도
                        </Button>
                    )
                }
            />
        </div>
    );
}

export { LoadError };
