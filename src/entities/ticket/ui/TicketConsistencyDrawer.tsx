import { ApiError } from '@shared/api/client';
import { getErrorMessage } from '@shared/api/errorMessage';
import { Badge } from '@shared/ui/badge';
import { Button } from '@shared/ui/button';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@shared/ui/sheet';
import { LoadingBlock, SkeletonRows } from '@shared/ui/skeleton';
import { formatKst } from '@shared/utils/date';

import { useAdminTicketHistories, useTicketConsistency } from '../api/admin';
import { TICKET_OPERATION_LABEL, TICKET_STATUS_LABEL } from '../model/admin';
import { TICKET_GRADE_LABEL } from '../model/grade';
import { MismatchValue } from './AdminTicketTables';

const HISTORY_PREVIEW_SIZE = 20;

/**
 * 사용자 응모권 정합성 서랍 — AO04 결과(일치 여부·사용 가능 장수·불일치 응모권)와
 * 그 사용자의 최근 이력(AO05)을 함께 보여준다. 불일치 원인은 마지막 이력을 봐야 알 수 있기 때문이다.
 * 조회 전용이라 수정·보정 버튼이 없다
 */
export function TicketConsistencyDrawer({
    userId,
    open,
    onOpenChange,
}: {
    userId: string | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}) {
    const activeUserId = open ? userId : null;
    const consistency = useTicketConsistency(activeUserId);
    const histories = useAdminTicketHistories(
        { page: 1, size: HISTORY_PREVIEW_SIZE, userId: userId ?? undefined },
        { enabled: Boolean(activeUserId) && consistency.isSuccess },
    );

    const notFound = consistency.error instanceof ApiError && consistency.error.status === 404;

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent className="overflow-y-auto sm:max-w-lg">
                <SheetHeader>
                    <SheetTitle>응모권 정합성</SheetTitle>
                    <SheetDescription>{userId ?? ''}</SheetDescription>
                </SheetHeader>
                <div className="flex flex-col gap-5 px-4 pb-6">
                    {consistency.isPending && consistency.fetchStatus !== 'idle' && (
                        <LoadingBlock>
                            <SkeletonRows rows={4} />
                        </LoadingBlock>
                    )}
                    {notFound && (
                        <p className="text-body-sm text-fg-secondary">
                            해당 사용자를 찾을 수 없습니다.
                        </p>
                    )}
                    {consistency.isError && !notFound && (
                        <div className="flex items-center gap-3" role="alert">
                            <p className="text-semantic-error-strong text-body-sm">
                                {getErrorMessage(
                                    consistency.error,
                                    '정합성을 불러오지 못했습니다.',
                                )}
                            </p>
                            <Button
                                size="sm"
                                variant="secondary"
                                onClick={() => void consistency.refetch()}
                            >
                                다시 시도
                            </Button>
                        </div>
                    )}
                    {consistency.data && (
                        <>
                            <div className="flex flex-wrap items-center gap-2">
                                <Badge variant={consistency.data.isConsistent ? 'info' : 'brand'}>
                                    {consistency.data.isConsistent ? '일치' : '불일치'}
                                </Badge>
                                <span className="text-body-sm text-fg-primary">
                                    사용 가능 {consistency.data.availableCount}장
                                </span>
                                <span className="text-caption text-fg-tertiary">
                                    확인 {formatKst(consistency.data.checkedAt)}
                                </span>
                            </div>

                            {consistency.data.inconsistencies.length > 0 && (
                                <section className="flex flex-col gap-2">
                                    <h3 className="text-body-sm text-fg-primary font-semibold">
                                        불일치 응모권
                                    </h3>
                                    {consistency.data.inconsistencies.map((item) => (
                                        <div
                                            key={item.ticketId}
                                            className="border-border-default flex flex-col gap-1 rounded-xl border p-3"
                                        >
                                            <span className="text-caption text-fg-tertiary break-all">
                                                {item.ticketId}
                                            </span>
                                            <div className="flex items-center justify-between gap-2">
                                                <span className="text-caption text-fg-tertiary">
                                                    응모권
                                                </span>
                                                <MismatchValue
                                                    status={item.ticketStatus}
                                                    version={item.ticketVersion}
                                                    differs
                                                />
                                            </div>
                                            <div className="flex items-center justify-between gap-2">
                                                <span className="text-caption text-fg-tertiary">
                                                    마지막 이력
                                                </span>
                                                <MismatchValue
                                                    status={item.latestHistoryStatus}
                                                    version={item.latestHistoryVersion}
                                                />
                                            </div>
                                        </div>
                                    ))}
                                </section>
                            )}

                            <section className="flex flex-col gap-2">
                                <h3 className="text-body-sm text-fg-primary font-semibold">
                                    최근 이력
                                </h3>
                                {histories.isPending && (
                                    <LoadingBlock>
                                        <SkeletonRows rows={3} />
                                    </LoadingBlock>
                                )}
                                {histories.isError && (
                                    <div className="flex items-center gap-3" role="alert">
                                        <p className="text-semantic-error-strong text-body-sm">
                                            이력을 불러오지 못했습니다.
                                        </p>
                                        <Button
                                            size="sm"
                                            variant="secondary"
                                            onClick={() => void histories.refetch()}
                                        >
                                            다시 시도
                                        </Button>
                                    </div>
                                )}
                                {histories.data && histories.data.items.length === 0 && (
                                    <p className="text-body-sm text-fg-tertiary">
                                        이력이 없습니다.
                                    </p>
                                )}
                                {histories.data?.items.map((history) => (
                                    <div
                                        key={history.id}
                                        className="border-border-default flex flex-col gap-0.5 rounded-xl border p-3"
                                    >
                                        <div className="flex items-center justify-between gap-2">
                                            <span className="text-body-sm text-fg-primary">
                                                {TICKET_OPERATION_LABEL[history.operationType]} ·{' '}
                                                {TICKET_GRADE_LABEL[history.grade]} →{' '}
                                                {TICKET_STATUS_LABEL[history.status]}
                                            </span>
                                            <span className="text-caption text-fg-tertiary">
                                                {formatKst(history.createdAt)}
                                            </span>
                                        </div>
                                        <span className="text-caption text-fg-tertiary break-all">
                                            {history.ticketId}
                                            {history.eventTitle ? ` · ${history.eventTitle}` : ''}
                                            {history.missionTitle
                                                ? ` · ${history.missionTitle}`
                                                : ''}
                                        </span>
                                    </div>
                                ))}
                            </section>
                        </>
                    )}
                </div>
            </SheetContent>
        </Sheet>
    );
}
