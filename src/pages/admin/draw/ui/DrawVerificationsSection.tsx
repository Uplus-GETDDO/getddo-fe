import { useState } from 'react';
import { toast } from 'sonner';

import { useDrawVerifications } from '@entities/drawResult';
import { useVerifyDraw } from '@features/runDraw';
import { getErrorMessage } from '@shared/api/errorMessage';
import { badgeVariants } from '@shared/ui/badge';
import { Button } from '@shared/ui/button';
import { LoadingBlock, SkeletonRows } from '@shared/ui/skeleton';
import { cn } from '@shared/utils/cn';
import { formatKst } from '@shared/utils/date';

import { PagedCount, PagedFooter } from './PagedFooter';

const PAGE_SIZE = 5;
// 상태·분류 칩 — 사용자 화면과 같은 공용 배지 모양(둥근 알약, 높이 26·글자 12)에 색만 칩마다 입힌다
const CHIP = badgeVariants({ variant: null });

interface DrawVerificationsSectionProps {
    drawId: string;
    /** 선정이 완료된 실행만 검증할 수 있다 (AD04 409 미확정 실행) */
    canVerify: boolean;
}

// AD04 정합성 검증 실행 + AD08 검증 이력. 검증은 저장된 결과를 대조할 뿐 난수를 다시 돌리지 않는다
export function DrawVerificationsSection({ drawId, canVerify }: DrawVerificationsSectionProps) {
    const [page, setPage] = useState(1);
    const { data, isPending, isError, refetch } = useDrawVerifications(drawId, {
        page,
        size: PAGE_SIZE,
    });
    const verify = useVerifyDraw();

    return (
        <section
            aria-labelledby="draw-verifications-title"
            className="bg-surface-page border-border-default flex flex-col gap-4 rounded-2xl border p-6"
        >
            <div className="flex items-start justify-between gap-4">
                <div className="flex flex-col gap-1">
                    <h3 id="draw-verifications-title" className="text-body-bold text-fg-primary">
                        정합성 검증
                    </h3>
                    <p className="text-caption text-fg-tertiary">
                        저장된 당첨 결과가 후보 명단·경품 규칙과 맞는지 대조합니다. 같은 당첨자를
                        다시 뽑는 작업이 아닙니다.
                    </p>
                </div>
                <Button
                    size="sm"
                    disabled={!canVerify || verify.isPending}
                    onClick={() => {
                        verify.mutate(drawId, {
                            onSuccess: (result) => {
                                if (result.passed) toast.success('정합성 검증을 통과했습니다');
                                else toast.error('정합성 검증에서 실패한 항목이 있습니다');
                                setPage(1);
                            },
                        });
                    }}
                >
                    {verify.isPending ? '검증 중…' : '정합성 검증 실행'}
                </Button>
            </div>

            {!canVerify && (
                <p className="text-caption text-fg-tertiary">
                    선정이 완료되지 않은 실행은 검증할 수 없습니다.
                </p>
            )}
            {verify.isError && (
                <p role="alert" className="text-semantic-error-strong text-body-sm">
                    {getErrorMessage(verify.error, '정합성 검증을 실행하지 못했습니다.')}
                </p>
            )}

            {isPending && (
                <LoadingBlock>
                    <SkeletonRows rows={3} />
                </LoadingBlock>
            )}
            {isError && (
                <div className="flex items-center gap-3" role="alert">
                    <p className="text-semantic-error-strong text-body-sm">
                        검증 이력을 불러오지 못했습니다.
                    </p>
                    <Button size="sm" variant="secondary" onClick={() => void refetch()}>
                        다시 시도
                    </Button>
                </div>
            )}
            {data && data.items.length === 0 && (
                <p className="text-body-sm text-fg-tertiary">검증 이력이 없습니다.</p>
            )}
            {data && data.items.length > 0 && (
                <>
                    <PagedCount total={data.totalElements} />
                    <ul className="flex flex-col gap-3">
                        {data.items.map((verification) => (
                            <li
                                key={verification.id}
                                className="border-border-default flex flex-col gap-2 rounded-xl border p-4"
                            >
                                <div className="flex flex-wrap items-center gap-2">
                                    <span
                                        className={cn(
                                            CHIP,
                                            verification.passed
                                                ? 'bg-status-approved text-status-approved-text'
                                                : 'bg-status-rejected text-status-rejected-text',
                                        )}
                                    >
                                        {verification.passed ? '통과' : '실패'}
                                    </span>
                                    <span className="text-body-sm text-fg-secondary">
                                        {formatKst(verification.verifiedAt)} ·{' '}
                                        {verification.verifiedByName ?? verification.verifiedBy}
                                    </span>
                                </div>
                                <ul className="text-body-sm flex flex-col gap-1">
                                    {verification.checks.map((check) => (
                                        <li key={check.code} className="flex gap-2">
                                            <span
                                                aria-label={check.passed ? '통과' : '실패'}
                                                className={
                                                    check.passed
                                                        ? 'text-status-approved-text'
                                                        : 'text-semantic-error-strong'
                                                }
                                            >
                                                {check.passed ? '✓' : '✕'}
                                            </span>
                                            <span className="text-fg-primary">{check.message}</span>
                                            <span className="text-caption text-fg-tertiary">
                                                {check.code}
                                            </span>
                                        </li>
                                    ))}
                                </ul>
                            </li>
                        ))}
                    </ul>
                    <PagedFooter
                        page={page}
                        size={PAGE_SIZE}
                        totalElements={data.totalElements}
                        onPageChange={setPage}
                    />
                </>
            )}
        </section>
    );
}
