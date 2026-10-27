import { badgeVariants } from '@shared/ui/badge';
import { cn } from '@shared/utils/cn';

/** 화면에 "정책 미확정"을 표시하는 칩 — 임의로 확정한 동작이 아니라 계약 대기 항목이라는 뜻이다 */
export function PolicyPendingChip({ className }: { className?: string }) {
    return (
        <span
            className={cn(
                badgeVariants({ variant: null }),
                'bg-status-pending text-status-pending-text',
                className,
            )}
        >
            정책 미확정
        </span>
    );
}
