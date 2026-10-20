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

// getddo-spec 00-requirements/pending-decisions.md "추첨과 결과 발표"에서 남은 항목 — 확정 전에는 동작을 만들지 않는다
const PENDING_ITEMS = [
    '최초 공개 전 재추첨의 관리자 확인 API (AD06은 최초 발표 이후 전용이라 최초 공개 전에는 호출하지 않습니다)',
    '최초 발표 지연 안내 문구와 새 발표 예정 시각의 제공 여부',
    '최초 발표 후 취소부터 공개 명단 갱신 전까지의 취소자 표시와 본인 중간 결과',
    '추첨 시작·재개의 감사 처리자·시각 계약',
    '시스템 장애·정합성 오류의 복구·재시도·취소 전환 기준',
];

export function PolicyPendingNotice() {
    return (
        <details className="bg-surface-page border-border-default rounded-2xl border p-5">
            <summary className="text-body-bold text-fg-primary focus-visible:ring-border-focus cursor-pointer rounded-md focus-visible:ring-2 focus-visible:outline-none">
                정책 미확정 항목 {PENDING_ITEMS.length}건 <PolicyPendingChip className="ml-2" />
            </summary>
            <ul className="text-body-sm text-fg-secondary mt-3 flex list-disc flex-col gap-1.5 pl-5">
                {PENDING_ITEMS.map((item) => (
                    <li key={item}>{item}</li>
                ))}
            </ul>
            <p className="text-caption text-fg-tertiary mt-3">
                해당 기능은 비활성 안내로만 표시하며, 계약이 확정되면 연결합니다.
            </p>
        </details>
    );
}
