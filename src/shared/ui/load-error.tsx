import { Button } from '@shared/ui/button';
import { EmptyState } from '@shared/ui/empty-state';
import { cn } from '@shared/utils/cn';

/**
 * 처음부터 받지 못했을 때의 칸 — 빈 상태 그림과 짧은 안내, '다시 시도'.
 * 빨간 한 줄('…불러오지 못했습니다') 대신 쓴다. 받아 둔 내용이 있으면 이 칸을 띄우지 말고 내용을 그대로 둔 채
 * 작은 갱신 표시(RefreshStatus)로만 알린다 — 다시 받기 실패로 화면이 비면 안 된다
 */
function LoadError({
    title,
    onRetry,
    retrying = false,
    size = 'sm',
    className,
}: {
    /** 무엇을 못 받았는지 — 예: '겟또타임을 불러오지 못했어요' */
    title: string;
    onRetry?: () => void;
    /** 다시 받는 중이면 버튼을 잠근다 */
    retrying?: boolean;
    size?: 'sm' | 'md';
    className?: string;
}) {
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
