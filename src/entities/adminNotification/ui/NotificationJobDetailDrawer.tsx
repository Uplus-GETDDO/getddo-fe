import type { ReactNode } from 'react';

import { Button } from '@shared/ui/button';
import {
    DetailItem,
    DetailList,
    DetailMeta,
    DetailSection,
    DetailSummary,
} from '@shared/ui/detail-list';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@shared/ui/sheet';
import { LoadingBlock, SkeletonRows } from '@shared/ui/skeleton';
import { formatKst } from '@shared/utils/date';

import type { NotificationJob } from '../model/types';

import { useAdminNotificationJob } from '../api/queries';
import { NOTIFICATION_TYPE_LABEL } from '../model/types';
import { AUTO_STOPPED_HINT, JobStatusTags } from './NotificationTags';

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
            <SheetContent className="sm:max-w-lg">
                <SheetHeader>
                    <SheetTitle>
                        {shown
                            ? `${NOTIFICATION_TYPE_LABEL[shown.notificationType]} 알림 작업`
                            : '알림 작업'}
                    </SheetTitle>
                    <SheetDescription>알림 작업 상세</SheetDescription>
                </SheetHeader>
                {shown && (
                    <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto px-6 py-5">
                        {/* 핵심 — 지금 상태와 처리 횟수, 다음에 무슨 일이 있는지 */}
                        <DetailSummary>
                            <JobStatusTags
                                status={shown.status}
                                stopped={shown.generationStoppedBy !== null}
                            />
                            <p className="text-body-sm text-fg-primary">
                                {shown.generationStoppedBy
                                    ? AUTO_STOPPED_HINT
                                    : shown.completedAt
                                      ? `${formatKst(shown.completedAt)}에 끝났어요`
                                      : shown.nextAttemptAt
                                        ? `${formatKst(shown.nextAttemptAt)}에 자동으로 다시 시도해요`
                                        : `${formatKst(shown.scheduledAt)} 예정`}
                            </p>
                            {detail?.lastError && (
                                <p className="text-body-sm text-status-rejected-text">
                                    마지막 오류 · {detail.lastError}
                                </p>
                            )}
                        </DetailSummary>

                        {action && <div>{action(shown, detailReady)}</div>}

                        <DetailSection title="처리">
                            <DetailList>
                                <DetailItem label="처리 횟수">{shown.attemptCount}회</DetailItem>
                                <DetailItem label="예정 시각">
                                    {formatKst(shown.scheduledAt)}
                                </DetailItem>
                                <DetailItem label="생성 시각">
                                    {formatKst(shown.createdAt)}
                                </DetailItem>
                                <DetailItem label="완료 시각">
                                    {kstOrDash(shown.completedAt)}
                                </DetailItem>
                                <DetailItem label="다음 재시도">
                                    {kstOrDash(shown.nextAttemptAt)}
                                </DetailItem>
                            </DetailList>
                        </DetailSection>

                        <DetailSection title="대상">
                            <DetailList>
                                <DetailItem label="이벤트">{shown.eventId ?? '-'}</DetailItem>
                                <DetailItem label="발표 건">
                                    {shown.publicationId ?? '-'}
                                </DetailItem>
                            </DetailList>
                        </DetailSection>

                        {detail ? (
                            <DetailSection title="진단">
                                <DetailList>
                                    <DetailItem label="원본 작업">
                                        {detail.sourceJobId ?? '-'}
                                    </DetailItem>
                                    <DetailItem label="마지막 처리">
                                        {detail.lastProcessedUserId ?? '-'}
                                    </DetailItem>
                                    <DetailItem label="선점 유효">
                                        {kstOrDash(detail.leaseUntil)}
                                    </DetailItem>
                                </DetailList>
                            </DetailSection>
                        ) : isPending ? (
                            <LoadingBlock label="상세 정보를 불러오는 중…">
                                <SkeletonRows rows={2} />
                            </LoadingBlock>
                        ) : (
                            isError && (
                                <div className="flex flex-col gap-2" role="alert">
                                    <p className="text-semantic-error-strong text-body-sm">
                                        상세 정보를 불러오지 못했습니다. 위는 목록에서 확인한
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

                        <DetailMeta>작업 ID {shown.id}</DetailMeta>
                    </div>
                )}
            </SheetContent>
        </Sheet>
    );
}
