import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';

import type { DrawResult, DrawRunDetail as DrawRunDetailData } from '@entities/drawResult';

import { DRAW_TYPE_LABEL, DRAWS_KEY, isDrawRunInProgress, useDrawRun } from '@entities/drawResult';
import { CancelWinDialog, ConfirmPublicationDialog, useResumeDraw } from '@features/runDraw';
import { PublishRedrawDialog, useStartRedraw } from '@features/runRedraw';
import { getErrorMessage } from '@shared/api/errorMessage';
import { Button } from '@shared/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@shared/ui/dialog';
import { Segmented } from '@shared/ui/segmented';
import { CardSkeleton, LoadingBlock } from '@shared/ui/skeleton';

import { useDrawRunDerived } from '../hooks/useDrawRunDerived';
import { DrawCandidatesSection } from './DrawCandidatesSection';
import { DrawOperationsSection } from './DrawOperationsSection';
import {
    DrawCancellationsSection,
    DrawFirstPublishSection,
    DrawPublishUpdateSection,
    DrawResultsSection,
    DrawRosterSection,
    DrawRunFailureSection,
    DrawRunSummarySection,
} from './DrawRunSections';
import { DrawVerificationsSection } from './DrawVerificationsSection';

type RunSection = 'results' | 'verifications' | 'candidates' | 'operations';
const RUN_SECTIONS: readonly { value: RunSection; label: string }[] = [
    { value: 'results', label: '추첨 결과' },
    { value: 'verifications', label: '정합성 검증' },
    { value: 'candidates', label: '후보 명단' },
    { value: 'operations', label: '운영 이력' },
];

interface DrawRunDetailProps {
    drawId: string;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    eventCanceled: boolean;
    /** 이벤트 상세 조회가 끝나 상태를 확인했을 때만 true — 확인 전엔 운영 행동을 막는다 */
    eventReady: boolean;
    /** 당첨 취소로 재추첨 실행이 생기면 그 실행으로 선택을 옮긴다 */
    onRunCreated: (drawId: string) => void;
}

// AD02 실행 상세 — 실행 목록 행에서 여는 중앙 모달. 닫아도 목록의 필터·페이지·선택 행은 유지된다.
// 실행 요약, 실패·재시도 정보, 취소 근거, 결과(당첨 취소 진입),
// 재추첨 시작·재개(AD09), 당첨자 공개(GD-199), 공개 명단 갱신(AD06), 운영 이력(GD-137)
export function DrawRunDetail({
    drawId,
    open,
    onOpenChange,
    eventCanceled,
    eventReady,
    onRunCreated,
}: DrawRunDetailProps) {
    const openerRef = useRef<HTMLElement | null>(null);
    const {
        data: run,
        isPending,
        isError,
        isRefetchError,
        dataUpdatedAt,
        refetch,
        isFetching,
    } = useDrawRun(drawId);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent
                className="flex max-h-[85vh] w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-4xl"
                onOpenAutoFocus={() => {
                    // 목록의 여러 버튼이 같은 모달을 열어 DialogTrigger 대신 실제 진입점을 보존한다.
                    openerRef.current =
                        document.activeElement instanceof HTMLElement
                            ? document.activeElement
                            : null;
                }}
                onCloseAutoFocus={(event) => {
                    if (openerRef.current?.isConnected) {
                        event.preventDefault();
                        openerRef.current.focus();
                    }
                }}
            >
                <DialogHeader className="px-6 pt-6 pb-4">
                    <DialogTitle className="text-title-3 text-fg-primary">
                        {run
                            ? `${run.runNumber}회차 ${DRAW_TYPE_LABEL[run.drawType]} 상세`
                            : '추첨 실행 상세'}
                    </DialogTitle>
                    <DialogDescription className="text-body-sm text-fg-secondary">
                        선정 결과·후보·정합성 검증·운영 이력을 확인하고 당첨자 공개·취소·재추첨을
                        진행합니다.
                    </DialogDescription>
                </DialogHeader>
                <div
                    className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto px-6 pb-6"
                    onFocusCapture={(event) => {
                        // Radix의 포커스 순환은 preventScroll을 사용해 스크롤 밖 버튼을 가릴 수 있다.
                        if (event.currentTarget.contains(event.target)) {
                            event.target.scrollIntoView({ block: 'nearest', inline: 'nearest' });
                        }
                    }}
                >
                    {isPending && (
                        <LoadingBlock>
                            <CardSkeleton rows={8} />
                        </LoadingBlock>
                    )}
                    {isError && (
                        <div className="flex items-center gap-3">
                            <p role="alert" className="text-semantic-error-strong text-body-sm">
                                추첨 실행 상세를 불러오지 못했습니다.
                            </p>
                            <Button size="sm" variant="secondary" onClick={() => void refetch()}>
                                다시 시도
                            </Button>
                        </div>
                    )}
                    {run && (
                        <RunDetailBody
                            run={run}
                            eventCanceled={eventCanceled}
                            eventReady={eventReady}
                            onRunCreated={onRunCreated}
                            refreshing={isFetching}
                            updatedAt={dataUpdatedAt}
                            refreshFailed={isRefetchError}
                            onRefresh={() => void refetch()}
                        />
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}

interface RunDetailBodyProps {
    run: DrawRunDetailData;
    eventCanceled: boolean;
    eventReady: boolean;
    onRunCreated: (drawId: string) => void;
    refreshing: boolean;
    /** 마지막 성공 조회 시각(ms) — TanStack Query의 dataUpdatedAt */
    updatedAt: number;
    /** 이전 데이터를 둔 채 배경 재조회만 실패한 상태 — 거짓 완료로 보이지 않게 구분한다 */
    refreshFailed: boolean;
    onRefresh: () => void;
}

function RunDetailBody({
    run,
    eventCanceled,
    eventReady,
    onRunCreated,
    refreshing,
    updatedAt,
    refreshFailed,
    onRefresh,
}: RunDetailBodyProps) {
    const [cancelTarget, setCancelTarget] = useState<DrawResult | null>(null);
    const [section, setSection] = useState<RunSection>('results');
    const [publishOpen, setPublishOpen] = useState(false);
    const [firstPublishOpen, setFirstPublishOpen] = useState(false);
    const start = useStartRedraw();
    const resumeInitial = useResumeDraw();
    const queryClient = useQueryClient();
    // 상세가 폴링으로 상태를 바꾸면 목록의 상태 칩도 같이 맞춘다 — 둘은 별도 쿼리다
    useEffect(() => {
        void queryClient.invalidateQueries({ queryKey: [...DRAWS_KEY, 'list'] });
    }, [queryClient, run.status]);
    const isRedraw = run.drawType === 'REPLACEMENT';
    const confirmed = run.status === 'CONFIRMED';
    const inProgress = isDrawRunInProgress(run.status);

    const {
        isLatestRun,
        publicationStates,
        anyBeforeFirstPublication,
        stillLoading,
        publicationCheckFailed,
        retryPublicationCheck,
        changePending,
        changeError,
        refetchChanges,
        firstPublished,
        alreadyPublished,
        hasUnpublishedCanceledResult,
        rosterLoading,
        rosterUnreadable,
        rosterComplete,
        rosterRows,
        publicationSummary,
    } = useDrawRunDerived(run);

    // 당첨자 공개(GD-199) — 이벤트가 공개되지 않았고 이 실행이 최신·선정 완료일 때만 연다
    const canFirstPublish =
        !changePending &&
        !changeError &&
        !firstPublished &&
        isLatestRun &&
        confirmed &&
        !eventCanceled &&
        eventReady &&
        rosterComplete;
    // 공개 후 재추첨 갱신(AD06) — 당첨자 공개 전에는 호출하지 않는다
    const canPublish =
        firstPublished &&
        isRedraw &&
        confirmed &&
        !eventCanceled &&
        eventReady &&
        !stillLoading &&
        !publicationCheckFailed &&
        !anyBeforeFirstPublication &&
        !hasUnpublishedCanceledResult &&
        !alreadyPublished;
    // 종료된 실행(NO_ENTRIES·NO_CANDIDATES)은 재개 불가 — 진행 중이거나 실패한 재추첨만 연다.
    // AD09 재개는 이 재추첨을 발생시킨 취소(replacementRunId가 이 실행)의 ID를 보낸다
    const causingCancellation = run.execution.cancellations.find(
        (c) => c.replacementRunId === run.id,
    );
    const canResume =
        isRedraw &&
        (inProgress || run.status === 'FAILED') &&
        causingCancellation != null &&
        !eventCanceled &&
        eventReady;
    // 실패한 최초 실행은 새로 만들지 않고 같은 실행을 재개한다 (GD-87) — 재추첨은 AD09로 재개한다
    const canResumeInitial = !isRedraw && run.status === 'FAILED' && !eventCanceled && eventReady;
    const cancelable = confirmed && !eventCanceled && eventReady;

    const resume = () => {
        if (!causingCancellation) return;
        start.mutate(causingCancellation.id, {
            onSuccess: () => toast.success('재추첨 실행을 시작·재개했습니다'),
        });
    };

    const resumeFirstRun = () => {
        resumeInitial.mutate(run.id, {
            onSuccess: () => toast.success('최초 추첨 실행을 재개했습니다'),
        });
    };

    const hasActions = inProgress || canResumeInitial || canResume;

    return (
        <div className="flex flex-col gap-6">
            <DrawRunSummarySection
                run={run}
                firstPublished={firstPublished}
                eventCanceled={eventCanceled}
                eventReady={eventReady}
                inProgress={inProgress}
                refreshing={refreshing}
                updatedAt={updatedAt}
                refreshFailed={refreshFailed}
                onRefresh={onRefresh}
                startError={
                    start.isError
                        ? getErrorMessage(start.error, '재추첨을 시작·재개하지 못했습니다.')
                        : null
                }
                resumeError={
                    resumeInitial.isError
                        ? getErrorMessage(resumeInitial.error, '최초 추첨을 재개하지 못했습니다.')
                        : null
                }
                hasActions={hasActions}
                canResumeInitial={canResumeInitial}
                canResume={canResume}
                resumeInitialPending={resumeInitial.isPending}
                startPending={start.isPending}
                onResumeFirstRun={resumeFirstRun}
                onResume={resume}
            />

            <DrawRunFailureSection run={run} />

            <DrawCancellationsSection
                run={run}
                publicationStates={publicationStates}
                onRunCreated={onRunCreated}
                onRetryPublicationCheck={retryPublicationCheck}
            />

            {!changePending && !firstPublished && (
                <DrawFirstPublishSection
                    isLatestRun={isLatestRun === true}
                    confirmed={confirmed}
                    changePending={changePending}
                    changeError={changeError}
                    canFirstPublish={canFirstPublish}
                    onOpen={() => setFirstPublishOpen(true)}
                    onRetry={() => void refetchChanges()}
                />
            )}

            {firstPublished && isRedraw && (
                <DrawPublishUpdateSection
                    confirmed={confirmed}
                    canPublish={canPublish}
                    alreadyPublished={alreadyPublished}
                    publicationCheckFailed={publicationCheckFailed}
                    anyBeforeFirstPublication={anyBeforeFirstPublication}
                    onOpen={() => setPublishOpen(true)}
                />
            )}

            <DrawRosterSection
                firstPublished={firstPublished}
                rosterComplete={rosterComplete}
                rosterLoading={rosterLoading}
                rosterUnreadable={rosterUnreadable}
                rosterRows={rosterRows}
                publicationSummary={publicationSummary}
            />

            {/* 결과·검증·후보 명단은 한 번에 하나만 — 카드가 세로로 길게 쌓이지 않게 */}
            <Segmented
                value={section}
                onValueChange={setSection}
                options={RUN_SECTIONS}
                label="실행 상세 보기"
                className="max-w-full flex-wrap self-start"
            />
            {section === 'results' && (
                <DrawResultsSection
                    run={run}
                    cancelable={cancelable}
                    onCancelResult={setCancelTarget}
                />
            )}
            {section === 'verifications' && (
                <DrawVerificationsSection drawId={run.id} canVerify={confirmed} />
            )}
            {section === 'candidates' && (
                <DrawCandidatesSection drawId={run.id} results={run.results} />
            )}
            {section === 'operations' && <DrawOperationsSection drawId={run.id} />}

            <CancelWinDialog
                result={cancelTarget}
                open={cancelTarget !== null}
                onCanceled={onRunCreated}
                onOpenChange={(open) => {
                    if (!open) setCancelTarget(null);
                }}
            />
            <PublishRedrawDialog run={run} open={publishOpen} onOpenChange={setPublishOpen} />
            <ConfirmPublicationDialog
                run={run}
                summary={rosterComplete ? publicationSummary : null}
                open={firstPublishOpen}
                onOpenChange={setFirstPublishOpen}
            />
        </div>
    );
}
