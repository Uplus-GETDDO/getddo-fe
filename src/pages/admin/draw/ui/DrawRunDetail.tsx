import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { toast } from 'sonner';

import type { DrawResult, DrawRunDetail as DrawRunDetailData } from '@entities/drawResult';

import {
    DRAW_EXECUTION_TYPE_LABEL,
    DRAW_RUN_STATUS_META,
    DRAWS_KEY,
    isDrawRunInProgress,
    useDrawRun,
    useDrawRuns,
} from '@entities/drawResult';
import { CancelWinDialog, useResumeDraw } from '@features/runDraw';
import { PublishRedrawDialog, useStartRedraw } from '@features/runRedraw';
import { getErrorMessage } from '@shared/api/errorMessage';
import { badgeVariants } from '@shared/ui/badge';
import { Button } from '@shared/ui/button';
import { Segmented } from '@shared/ui/segmented';
import { CardSkeleton, LoadingBlock } from '@shared/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@shared/ui/table';
import { cn } from '@shared/utils/cn';
import { formatKst } from '@shared/utils/date';

import { DrawCandidatesSection } from './DrawCandidatesSection';
import { DrawVerificationsSection } from './DrawVerificationsSection';
import { PolicyPendingChip } from './PolicyPendingNotice';

// 상태·분류 칩 — 사용자 화면과 같은 공용 배지 모양(둥근 알약, 높이 26·글자 12)에 색만 칩마다 입힌다
const CHIP = badgeVariants({ variant: null });

type RunSection = 'results' | 'verifications' | 'candidates';
const RUN_SECTIONS: readonly { value: RunSection; label: string }[] = [
    { value: 'results', label: '추첨 결과' },
    { value: 'verifications', label: '정합성 검증' },
    { value: 'candidates', label: '후보 명단' },
];

function Field({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div className="flex items-start gap-6">
            <span className="text-body-sm text-fg-tertiary w-32 shrink-0 pt-0.5">{label}</span>
            <div className="text-body-sm text-fg-primary min-w-0">{children}</div>
        </div>
    );
}

function ResultChips({ result }: { result: DrawResult }) {
    if (result.resultType === 'UNFILLED') {
        return <span className={cn(CHIP, 'bg-surface-sunken text-fg-secondary')}>미충원</span>;
    }
    return (
        <span className="flex flex-wrap gap-1">
            {result.isCanceled ? (
                <span className={cn(CHIP, 'bg-status-rejected text-status-rejected-text')}>
                    당첨 취소
                </span>
            ) : (
                <span className={cn(CHIP, 'bg-status-approved text-status-approved-text')}>
                    당첨
                </span>
            )}
            {/* 공개 이력은 현재 명단 포함 여부와 다르다 — 취소된 결과도 공개된 적이 있으면 표시한다 */}
            <span className={cn(CHIP, 'bg-surface-sunken text-fg-secondary')}>
                {result.wasPublished ? '공개 이력 있음' : '미공개'}
            </span>
        </span>
    );
}

interface DrawRunDetailProps {
    drawId: string;
    eventCanceled: boolean;
    /** 이벤트 상세 조회가 끝나 상태를 확인했을 때만 true — 확인 전엔 운영 행동을 막는다 */
    eventReady: boolean;
    /** 당첨 취소로 재추첨 실행이 생기면 그 실행으로 선택을 옮긴다 */
    onRunCreated: (drawId: string) => void;
    /** 다음 행동 버튼을 그릴 자리 — 이벤트 머리 카드. 없으면 실행 요약 카드 안에 그린다 */
    actionSlot?: HTMLElement | null;
}

// AD02 실행 상세 — 실행 요약, 실패 정보, 취소 근거, 결과(당첨 취소 진입), 재추첨 시작·재개와 공개 반영
export function DrawRunDetail({
    drawId,
    eventCanceled,
    eventReady,
    onRunCreated,
    actionSlot,
}: DrawRunDetailProps) {
    const { data: run, isPending, isError, refetch, isFetching } = useDrawRun(drawId);

    if (isPending) {
        return (
            <LoadingBlock>
                <CardSkeleton rows={8} />
            </LoadingBlock>
        );
    }
    if (isError) {
        return (
            <div className="flex items-center gap-3">
                <p role="alert" className="text-semantic-error-strong text-body-sm">
                    추첨 실행 상세를 불러오지 못했습니다.
                </p>
                <Button size="sm" variant="secondary" onClick={() => void refetch()}>
                    다시 시도
                </Button>
            </div>
        );
    }

    return (
        <RunDetailBody
            run={run}
            eventCanceled={eventCanceled}
            eventReady={eventReady}
            onRunCreated={onRunCreated}
            actionSlot={actionSlot}
            refreshing={isFetching}
            onRefresh={() => void refetch()}
        />
    );
}

interface RunDetailBodyProps {
    run: DrawRunDetailData;
    eventCanceled: boolean;
    eventReady: boolean;
    onRunCreated: (drawId: string) => void;
    actionSlot?: HTMLElement | null;
    refreshing: boolean;
    onRefresh: () => void;
}

function RunDetailBody({
    run,
    eventCanceled,
    eventReady,
    onRunCreated,
    actionSlot,
    refreshing,
    onRefresh,
}: RunDetailBodyProps) {
    const [cancelTarget, setCancelTarget] = useState<DrawResult | null>(null);
    const [section, setSection] = useState<RunSection>('results');
    const [publishOpen, setPublishOpen] = useState(false);
    const start = useStartRedraw();
    const resumeInitial = useResumeDraw();
    const queryClient = useQueryClient();
    // 상세가 폴링으로 상태를 바꾸면 목록의 상태 칩도 같이 맞춘다 — 둘은 별도 쿼리다
    useEffect(() => {
        void queryClient.invalidateQueries({ queryKey: [...DRAWS_KEY, 'list'] });
    }, [queryClient, run.status]);
    const status = DRAW_RUN_STATUS_META[run.status];
    const isRedraw = run.originalDrawId !== null;
    const confirmed = run.status === 'CONFIRMED';
    const inProgress = isDrawRunInProgress(run.status);

    // 재추첨이 취소한 결과가 최초 발표 이후 공개된 적이 있는지 — AD06 사용 가능 여부를 가른다
    const canceledRunIds = [...new Set(run.cancellations.map((c) => c.canceledDrawRunId))];
    const canceledRuns = useDrawRuns(canceledRunIds);
    // 공개 이력 조회 결과를 로딩·실패·발표 전·후로 구분한다 — 실패는 공개 반영을 막는다
    const publicationOf = (canceledResultId: string, canceledRunId: string) => {
        const query = canceledRuns[canceledRunIds.indexOf(canceledRunId)];
        if (query?.isError) return 'error' as const;
        if (!query?.data) return 'loading' as const;
        const result = query.data.results.find((r) => r.id === canceledResultId);
        return result?.wasPublished ? ('after' as const) : ('before' as const);
    };
    const publicationStates = run.cancellations.map((c) =>
        publicationOf(c.canceledDrawResultId, c.canceledDrawRunId),
    );
    const anyBeforeFirstPublication = publicationStates.includes('before');
    const stillLoading = publicationStates.includes('loading');
    const publicationCheckFailed = publicationStates.includes('error');

    const selectedResults = run.results.filter((r) => r.resultType === 'SELECTED');
    const alreadyPublished =
        selectedResults.length > 0 && selectedResults.every((r) => r.wasPublished);
    // 공개 전에 취소된 결과가 남은 실행을 반영하면 공개 명단에 빈 자리가 생긴다 — 취소의 재추첨 결과로 반영한다
    const hasUnpublishedCanceledResult = selectedResults.some(
        (r) => r.isCanceled && !r.wasPublished,
    );

    const canPublish =
        isRedraw &&
        confirmed &&
        !eventCanceled &&
        eventReady &&
        !stillLoading &&
        !publicationCheckFailed &&
        !anyBeforeFirstPublication &&
        !hasUnpublishedCanceledResult &&
        !alreadyPublished;
    // 종료된 실행(NO_ENTRIES·NO_CANDIDATES)은 재개 불가 — 진행 중이거나 실패한 재추첨만 연다
    const canResume =
        isRedraw &&
        (inProgress || run.status === 'FAILED') &&
        run.cancellations.length > 0 &&
        !eventCanceled &&
        eventReady;
    // 실패한 최초 실행은 새로 만들지 않고 같은 실행을 재개한다 (GD-87) — 재추첨은 AD09로 재개한다
    const canResumeInitial = !isRedraw && run.status === 'FAILED' && !eventCanceled && eventReady;
    const cancelable = confirmed && !eventCanceled && eventReady;

    const resume = () => {
        const cancellation = run.cancellations[0];
        if (!cancellation) return;
        start.mutate(cancellation.id, {
            onSuccess: () => toast.success('재추첨 실행을 시작·재개했습니다'),
        });
    };

    const resumeFirstRun = () => {
        resumeInitial.mutate(run.id, {
            onSuccess: () => toast.success('최초 추첨 실행을 재개했습니다'),
        });
    };

    const hasActions = inProgress || canResumeInitial || canResume;
    // 다음 행동 — 이벤트 머리 카드(actionSlot)로 올려 첫눈에 보이게 한다. 어느 실행의 행동인지 함께 적는다
    const actions = hasActions && (
        <div className="flex flex-wrap items-center gap-3">
            <span className="text-body-sm text-fg-secondary">
                다음 할 일 · {run.runNumber}회차 {isRedraw ? '재추첨' : '최초 추첨'}
            </span>
            <div className="flex flex-wrap items-center gap-2">
                {inProgress && (
                    <Button size="sm" variant="secondary" disabled={refreshing} onClick={onRefresh}>
                        상태 새로고침
                    </Button>
                )}
                {canResumeInitial && (
                    <Button size="sm" disabled={resumeInitial.isPending} onClick={resumeFirstRun}>
                        {resumeInitial.isPending ? '요청 중…' : '최초 추첨 재개'}
                    </Button>
                )}
                {canResume && (
                    <Button size="sm" disabled={start.isPending} onClick={resume}>
                        {start.isPending ? '요청 중…' : '재추첨 시작·재개'}
                    </Button>
                )}
            </div>
        </div>
    );

    return (
        <div className="flex flex-col gap-6">
            {actionSlot && actions ? createPortal(actions, actionSlot) : null}
            <section
                aria-labelledby="draw-run-summary-title"
                className="bg-surface-page border-border-default flex flex-col gap-4 rounded-2xl border p-6"
            >
                <div className="flex flex-wrap items-center gap-3">
                    <h3 id="draw-run-summary-title" className="text-body-bold text-fg-primary">
                        {run.runNumber}회차 {isRedraw ? '재추첨' : '최초 추첨'}
                    </h3>
                    <span className={cn(CHIP, status.chipClass)}>{status.label}</span>
                    {!actionSlot && actions && <div className="ml-auto">{actions}</div>}
                </div>

                <Field label="실행 ID">{run.id}</Field>
                <Field label="구분">{DRAW_EXECUTION_TYPE_LABEL[run.executionType]}</Field>
                <Field label="후보 고정">
                    {run.snapshotFixedAt ? formatKst(run.snapshotFixedAt) : '—'} · 같은 실행을
                    재시도하면 고정된 명단·조건을 그대로 씁니다
                </Field>
                <Field label="시작 / 확정">
                    {run.startedAt ? formatKst(run.startedAt) : '—'} /{' '}
                    {run.confirmedAt ? formatKst(run.confirmedAt) : '—'}
                </Field>
                <Field label="알고리즘">{run.algorithmVersion ?? '—'}</Field>
                {isRedraw && (
                    <Field label="시작·재개 처리">
                        <span className="text-fg-tertiary">처리자·시각 기록 미제공</span>{' '}
                        <PolicyPendingChip />
                    </Field>
                )}

                {inProgress && (
                    <p role="status" className="text-body-sm text-fg-secondary">
                        서버가 {run.status === 'PREPARING' ? '실행을 준비' : '당첨자를 선정'}하고
                        있습니다. 완료될 때까지 30초마다 자동으로 확인합니다.
                    </p>
                )}
                {start.isError && (
                    <p role="alert" className="text-semantic-error-strong text-body-sm">
                        {getErrorMessage(start.error, '재추첨을 시작·재개하지 못했습니다.')}
                    </p>
                )}
                {resumeInitial.isError && (
                    <p role="alert" className="text-semantic-error-strong text-body-sm">
                        {getErrorMessage(resumeInitial.error, '최초 추첨을 재개하지 못했습니다.')}
                    </p>
                )}
                {eventCanceled && (
                    <p className="text-body-sm text-fg-secondary">
                        취소된 이벤트라 당첨 취소·재추첨·공개 반영을 할 수 없습니다.
                    </p>
                )}
                {!eventReady && (
                    <p className="text-body-sm text-fg-secondary">
                        이벤트 정보를 확인하지 못해 당첨 취소·재추첨·공개 반영을 사용할 수 없습니다.
                    </p>
                )}
            </section>

            {run.lastFailureCode && (
                <section
                    aria-labelledby="draw-run-failure-title"
                    className="bg-surface-page border-border-default flex flex-col gap-3 rounded-2xl border p-6"
                >
                    <h3 id="draw-run-failure-title" className="text-body-bold text-fg-primary">
                        실패 정보
                    </h3>
                    <Field label="실패 코드">{run.lastFailureCode}</Field>
                    <Field label="안내">{run.lastFailureMessage ?? '—'}</Field>
                    <Field label="실패 횟수">{run.failureCount}회</Field>
                    <Field label="마지막 실패">
                        {run.lastFailedAt ? formatKst(run.lastFailedAt) : '—'}
                        {run.lastFailureTraceId && ` · 추적 ${run.lastFailureTraceId}`}
                    </Field>
                    <p className="text-caption text-fg-tertiary">
                        복구·재시도·취소 전환 기준은 <PolicyPendingChip /> 상태입니다. 같은 실행의
                        재개(AD09)만 제공합니다.
                    </p>
                </section>
            )}

            {run.cancellations.length > 0 && (
                <section
                    aria-labelledby="draw-run-cancel-title"
                    className="bg-surface-page border-border-default flex flex-col gap-4 rounded-2xl border p-6"
                >
                    <h3 id="draw-run-cancel-title" className="text-body-bold text-fg-primary">
                        당첨 취소 근거
                    </h3>
                    <ul className="flex flex-col gap-3">
                        {run.cancellations.map((c, index) => {
                            const state = publicationStates[index];
                            return (
                                <li
                                    key={c.id}
                                    className="border-border-default flex flex-col gap-1 rounded-xl border p-4"
                                >
                                    <p className="text-body-sm text-fg-primary">{c.reason}</p>
                                    <p className="text-caption text-fg-tertiary">
                                        {c.canceledBy} · {formatKst(c.canceledAt)} · 취소 ID {c.id}
                                    </p>
                                    <p className="text-caption text-fg-secondary">
                                        {state === 'loading' && '공개 이력 확인 중…'}
                                        {state === 'after' && '최초 발표 후 취소한 당첨입니다.'}
                                        {state === 'before' && '최초 공개 전에 취소한 당첨입니다.'}
                                        {state === 'error' && '공개 이력을 불러오지 못했습니다.'}
                                    </p>
                                    {state === 'error' && (
                                        <Button
                                            size="sm"
                                            variant="secondary"
                                            className="self-start"
                                            onClick={() =>
                                                void canceledRuns[
                                                    canceledRunIds.indexOf(c.canceledDrawRunId)
                                                ]?.refetch()
                                            }
                                        >
                                            공개 이력 다시 확인
                                        </Button>
                                    )}
                                </li>
                            );
                        })}
                    </ul>
                </section>
            )}

            {isRedraw && (
                <section
                    aria-labelledby="draw-run-publish-title"
                    className="bg-surface-page border-border-default flex flex-col gap-3 rounded-2xl border p-6"
                >
                    <div className="flex items-center gap-3">
                        <h3 id="draw-run-publish-title" className="text-body-bold text-fg-primary">
                            공개 명단 반영
                        </h3>
                        <Button
                            size="sm"
                            disabled={!canPublish}
                            onClick={() => setPublishOpen(true)}
                        >
                            공개 명단 반영
                        </Button>
                    </div>
                    {alreadyPublished && (
                        <p className="text-body-sm text-fg-secondary">
                            이 재추첨 결과는 이미 공개 명단에 반영됐습니다.
                        </p>
                    )}
                    {!confirmed && (
                        <p className="text-body-sm text-fg-secondary">
                            재추첨이 확정되면 공개 명단에 반영할 수 있습니다.
                        </p>
                    )}
                    {confirmed && publicationCheckFailed && (
                        <p className="text-body-sm text-fg-secondary">
                            취소한 원본 실행의 공개 이력을 불러오지 못했습니다. 확인이 끝날 때까지
                            공개 명단에 반영할 수 없습니다.
                        </p>
                    )}
                    {confirmed && anyBeforeFirstPublication && (
                        <p className="text-body-sm text-fg-secondary">
                            최초 공개 전 취소가 포함돼 이 API(AD06)로 반영할 수 없습니다. 최초 공개
                            전 재추첨은 관리자 확인 후 수동 공개로 함께 공개됩니다.
                        </p>
                    )}
                    {confirmed && !anyBeforeFirstPublication && !alreadyPublished && (
                        <p className="text-body-sm text-fg-secondary">
                            반영 전까지 취소자 표시와 본인 중간 결과는 <PolicyPendingChip /> 입니다.
                            관리자 미확인 결과는 사용자에게 노출되지 않습니다.
                        </p>
                    )}
                </section>
            )}

            {/* 결과·검증·후보 명단은 한 번에 하나만 — 카드가 세로로 길게 쌓이지 않게 */}
            <Segmented
                value={section}
                onValueChange={setSection}
                options={RUN_SECTIONS}
                label="실행 상세 보기"
                className="self-start"
            />
            {section === 'results' && (
                <section
                    aria-labelledby="draw-run-results-title"
                    className="bg-surface-page border-border-default flex flex-col gap-4 rounded-2xl border p-6"
                >
                    <h3 id="draw-run-results-title" className="text-body-bold text-fg-primary">
                        추첨 결과
                    </h3>
                    {run.results.length === 0 ? (
                        <p className="text-body-sm text-fg-tertiary">
                            {inProgress
                                ? '선정이 끝나면 결과가 표시됩니다. 진행 중인 결과는 미충원으로 처리하지 않습니다.'
                                : '표시할 결과가 없습니다.'}
                        </p>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow className="hover:bg-transparent">
                                    <TableHead>등수</TableHead>
                                    <TableHead>슬롯</TableHead>
                                    <TableHead>당첨자</TableHead>
                                    <TableHead>상태</TableHead>
                                    <TableHead>당첨 취소</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {run.results.map((result) => (
                                    <TableRow key={result.id} className="hover:bg-transparent">
                                        <TableCell>{result.prizeRank}등</TableCell>
                                        <TableCell>{result.slotNumber}</TableCell>
                                        <TableCell className="font-medium">
                                            {result.userId ?? '—'}
                                        </TableCell>
                                        <TableCell>
                                            <ResultChips result={result} />
                                        </TableCell>
                                        <TableCell>
                                            {result.resultType === 'SELECTED' &&
                                                !result.isCanceled && (
                                                    <Button
                                                        size="sm"
                                                        variant="secondary"
                                                        disabled={!cancelable}
                                                        aria-label={`${result.slotNumber}번 슬롯 당첨 취소`}
                                                        onClick={() => setCancelTarget(result)}
                                                    >
                                                        취소
                                                    </Button>
                                                )}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </section>
            )}
            {section === 'verifications' && (
                <DrawVerificationsSection drawId={run.id} canVerify={confirmed} />
            )}
            {section === 'candidates' && <DrawCandidatesSection drawId={run.id} />}

            <CancelWinDialog
                result={cancelTarget}
                open={cancelTarget !== null}
                onCanceled={onRunCreated}
                onOpenChange={(open) => {
                    if (!open) setCancelTarget(null);
                }}
            />
            <PublishRedrawDialog run={run} open={publishOpen} onOpenChange={setPublishOpen} />
        </div>
    );
}
