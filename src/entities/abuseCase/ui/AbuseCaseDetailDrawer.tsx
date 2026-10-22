import type { ReactNode } from 'react';

import { Button } from '@shared/ui/button';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@shared/ui/sheet';
import { LoadingBlock, SkeletonRows } from '@shared/ui/skeleton';
import { formatKst } from '@shared/utils/date';

import type { AbuseCase } from '../model/types';

import { useAbuseCase } from '../api/queries';
import {
    ABUSE_DETECTION_TYPE_LABEL,
    ABUSE_SOURCE_TYPE_LABEL,
    ABUSE_TRIGGER_SCOPE_LABEL,
} from '../model/types';

const FIELD = 'text-caption text-fg-tertiary';
const VALUE = 'text-body-sm text-fg-primary break-all';

function Field({ label, children }: { label: string; children: ReactNode }) {
    return (
        <div className="flex flex-col gap-1">
            <span className={FIELD}>{label}</span>
            <span className={VALUE}>{children}</span>
        </div>
    );
}

/**
 * 차단 내역 상세 드로어 — 목록 요약을 먼저 보여주고, AR02 상세가 오면
 * 차단 판정 근거(evidence)를 덧붙인다. 차단 기록은 조회 전용이라 액션 버튼이 없다.
 */
export function AbuseCaseDetailDrawer({
    abuseCase,
    open,
    onOpenChange,
}: {
    abuseCase: AbuseCase | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}) {
    const {
        data: detail,
        isPending,
        isError,
        refetch,
    } = useAbuseCase(open ? (abuseCase?.id ?? null) : null);
    const shown = abuseCase;

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent className="overflow-y-auto sm:max-w-md">
                <SheetHeader>
                    <SheetTitle>차단 내역 상세</SheetTitle>
                    <SheetDescription>{shown ? formatKst(shown.blockedAt) : ''}</SheetDescription>
                </SheetHeader>
                {shown && (
                    <div className="flex flex-col gap-4 px-4 pb-6">
                        <Field label="구분">{ABUSE_SOURCE_TYPE_LABEL[shown.sourceType]}</Field>
                        <Field label="사용자">
                            {shown.userNickname}{' '}
                            <span className="text-fg-tertiary">({shown.userId})</span>
                        </Field>
                        <Field label="관련 이벤트">{shown.eventTitle ?? '-'}</Field>
                        <Field label="탐지 유형">
                            {ABUSE_DETECTION_TYPE_LABEL[shown.detectionType]}
                        </Field>
                        <Field label="차단 사유">{shown.detectionReason}</Field>
                        <Field label="차단 시작">{formatKst(shown.blockedAt)}</Field>
                        <Field label="차단 종료 예정">{formatKst(shown.blockedUntil)}</Field>
                        {detail ? (
                            <div className="bg-surface-sunken text-fg-secondary text-caption flex flex-col gap-1 rounded-lg p-3">
                                <span className={FIELD}>차단 판정 근거</span>
                                <span>규칙 버전 · {detail.evidence.ruleVersion}</span>
                                <span>
                                    판정 기준 ·{' '}
                                    {ABUSE_TRIGGER_SCOPE_LABEL[detail.evidence.triggerScope]}
                                </span>
                                <span>
                                    집계 구간 · {formatKst(detail.evidence.windowStartedAt)} ~{' '}
                                    {formatKst(detail.evidence.windowEndsAt)}
                                </span>
                                <span>요청 허용 한도 · {detail.evidence.requestLimit}건</span>
                                <span>관측 거절 횟수 · {detail.evidence.rejectedCount}건</span>
                                <span>차단 기준 횟수 · {detail.evidence.rejectionThreshold}건</span>
                            </div>
                        ) : (
                            isPending && (
                                <LoadingBlock label="상세 정보를 불러오는 중…">
                                    <SkeletonRows rows={2} />
                                </LoadingBlock>
                            )
                        )}
                        {isError && (
                            <div className="flex items-center gap-3">
                                <p className="text-semantic-error-strong text-body-sm">
                                    상세 정보를 불러오지 못했습니다.
                                </p>
                                <Button
                                    variant="secondary"
                                    size="sm"
                                    onClick={() => void refetch()}
                                >
                                    다시 시도
                                </Button>
                            </div>
                        )}
                        <Field label="차단 기록 ID">{shown.id}</Field>
                    </div>
                )}
            </SheetContent>
        </Sheet>
    );
}
