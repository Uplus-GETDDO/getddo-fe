import type { ReactNode } from 'react';

import { Button } from '@shared/ui/button';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@shared/ui/sheet';
import { LoadingBlock, SkeletonRows } from '@shared/ui/skeleton';
import { formatKst } from '@shared/utils/date';

import type { AbuseCase } from '../model/types';

import { useAbuseCase } from '../api/queries';
import { ABUSE_TARGET_LABEL, REWARD_SOURCE_LABEL } from '../model/types';

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

const subjectOf = (abuseCase: AbuseCase) =>
    abuseCase.target === 'entry'
        ? (abuseCase.eventTitle ?? '-')
        : `${REWARD_SOURCE_LABEL[abuseCase.rewardSource ?? 'attendance']} 지급`;

/**
 * 차단 내역 상세 드로어 — 목록 요약을 먼저 보여주고, AR02 상세가 오면
 * 서버 검증이 남긴 검증 근거를 덧붙인다. 차단 기록은 조회 전용이라 액션 버튼이 없다.
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
                    <SheetDescription>{shown ? formatKst(shown.detectedAt) : ''}</SheetDescription>
                </SheetHeader>
                {shown && (
                    <div className="flex flex-col gap-4 px-4 pb-6">
                        <Field label="구분">
                            {ABUSE_TARGET_LABEL[shown.target]}
                            {shown.rewardSource
                                ? ` · ${REWARD_SOURCE_LABEL[shown.rewardSource]}`
                                : ''}
                        </Field>
                        <Field label="사용자">
                            {shown.userNickname}{' '}
                            <span className="text-fg-tertiary">({shown.userId})</span>
                        </Field>
                        <Field label="대상">{subjectOf(shown)}</Field>
                        <Field label="차단 사유">{shown.reason}</Field>
                        <Field label="관련 요청">{shown.requestSummary}</Field>
                        <Field label="발생 시각">{formatKst(shown.detectedAt)}</Field>
                        {detail
                            ? detail.evidence.length > 0 && (
                                  <div className="flex flex-col gap-1">
                                      <span className={FIELD}>검증 근거</span>
                                      <ul className="bg-surface-sunken text-fg-secondary text-caption flex flex-col gap-1 rounded-lg p-3">
                                          {detail.evidence.map((item) => (
                                              <li key={item}>· {item}</li>
                                          ))}
                                      </ul>
                                  </div>
                              )
                            : isPending && (
                                  <LoadingBlock label="상세 정보를 불러오는 중…">
                                      <SkeletonRows rows={2} />
                                  </LoadingBlock>
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
