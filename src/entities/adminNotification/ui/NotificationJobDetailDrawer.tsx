import type { ReactNode } from 'react';

import { Button } from '@shared/ui/button';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@shared/ui/sheet';
import { LoadingBlock, SkeletonRows } from '@shared/ui/skeleton';
import { formatKst } from '@shared/utils/date';

import type { NotificationJob } from '../model/types';

import { useAdminNotificationJob } from '../api/queries';
import { NOTIFICATION_JOB_STATUS_LABEL, NOTIFICATION_TYPE_LABEL } from '../model/types';

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

const kstOrDash = (iso: string | null) => (iso ? formatKst(iso) : '-');

/**
 * 알림 생성 작업 상세 드로어 — 목록 값으로 먼저 채우고 AN02 상세가 오면 진단 필드를 덧붙인다.
 * 복구 재시도 같은 사용자 행동은 페이지가 action 슬롯으로 주입한다 (entities는 features를 모른다).
 */
export function NotificationJobDetailDrawer({
    job,
    open,
    onOpenChange,
    action,
}: {
    job: NotificationJob | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    /** 복구 재시도 버튼 등 행동 슬롯 — 현재 상세 대상과 상세 조회 완료 여부를 인자로 받는다 */
    action?: (job: NotificationJob, detailReady: boolean) => ReactNode;
}) {
    const {
        data: detail,
        isPending,
        isError,
        refetch,
    } = useAdminNotificationJob(open ? (job?.id ?? null) : null);
    // 요약 필드는 목록 값으로 먼저 채우고, 상세 응답이 오면 최신 상태로 갈아 끼운다
    const shown = detail ?? job;
    // 상세 조회가 실패·진행 중이면 복구 같은 운영 행동은 목록 값만으로 판단할 수 없어 막는다
    const detailReady = detail != null && !isError;

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent className="overflow-y-auto sm:max-w-md">
                <SheetHeader>
                    <SheetTitle>알림 작업 상세</SheetTitle>
                    <SheetDescription>{job ? job.id : ''}</SheetDescription>
                </SheetHeader>
                {shown && (
                    <div className="flex flex-col gap-4 px-4 pb-6">
                        <Field label="유형">
                            {NOTIFICATION_TYPE_LABEL[shown.notificationType]}{' '}
                            <span className="text-fg-tertiary">({shown.notificationType})</span>
                        </Field>
                        <Field label="상태">
                            {NOTIFICATION_JOB_STATUS_LABEL[shown.status]}
                            {shown.generationStoppedBy &&
                                ` · 생성 중지 (${shown.generationStoppedBy})`}
                        </Field>
                        <Field label="이벤트">{shown.eventId ?? '-'}</Field>
                        <Field label="발표 건">{shown.publicationId ?? '-'}</Field>
                        <Field label="처리 차수">{shown.attemptCount}회</Field>
                        <Field label="예정 시각">{formatKst(shown.scheduledAt)}</Field>
                        <Field label="생성 시각">{formatKst(shown.createdAt)}</Field>
                        <Field label="다음 자동 재시도">{kstOrDash(shown.nextAttemptAt)}</Field>
                        <Field label="완료 시각">{kstOrDash(shown.completedAt)}</Field>
                        <Field label="복구 가능">{shown.retryable ? '가능' : '불가'}</Field>
                        {detail ? (
                            <>
                                <Field label="마지막 오류">{detail.lastError ?? '-'}</Field>
                                <Field label="원본 작업">{detail.sourceJobId ?? '-'}</Field>
                                <Field label="마지막 처리 사용자">
                                    {detail.lastProcessedUserId ?? '-'}
                                </Field>
                                <Field label="선점 유효 시각">{kstOrDash(detail.leaseUntil)}</Field>
                            </>
                        ) : isPending ? (
                            <LoadingBlock label="상세 정보를 불러오는 중…">
                                <SkeletonRows rows={2} />
                            </LoadingBlock>
                        ) : (
                            isError && (
                                <div className="flex flex-col gap-2" role="alert">
                                    <p className="text-semantic-error-strong text-body-sm">
                                        상세 정보를 불러오지 못했습니다. 아래는 목록에서 확인한
                                        정보입니다.
                                    </p>
                                    <Button
                                        variant="secondary"
                                        className="self-start"
                                        onClick={() => void refetch()}
                                    >
                                        다시 시도
                                    </Button>
                                </div>
                            )
                        )}
                        {action?.(shown, detailReady)}
                    </div>
                )}
            </SheetContent>
        </Sheet>
    );
}
