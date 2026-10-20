import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { toast } from 'sonner';

import type { DrawResult, DrawRunDetail as DrawRunDetailData } from '@entities/drawResult';

import {
    DRAW_RUN_STATUS_META,
    DRAW_TYPE_LABEL,
    DRAWS_KEY,
    drawRunOptions,
    fetchEventDrawsPage,
    isDrawRunInProgress,
    useDrawRun,
    useDrawRuns,
    useEventDraws,
} from '@entities/drawResult';
import { useResultChanges } from '@entities/winner';
import { CancelWinDialog, ConfirmPublicationDialog, useResumeDraw } from '@features/runDraw';
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
import { DrawOperationsSection } from './DrawOperationsSection';
import { DrawVerificationsSection } from './DrawVerificationsSection';
import { PolicyPendingChip } from './PolicyPendingNotice';

// 상태·분류 칩 — 사용자 화면과 같은 공용 배지 모양(둥근 알약, 높이 26·글자 12)에 색만 칩마다 입힌다
const CHIP = badgeVariants({ variant: null });

// 실행 목록 페이지 크기 — 이 크기를 넘는 과거 실행은 취소 원본 탐색에서 추가 페이지로 읽는다
const RUN_LIST_PAGE_SIZE = 100;

type RunSection = 'results' | 'verifications' | 'candidates' | 'operations';
const RUN_SECTIONS: readonly { value: RunSection; label: string }[] = [
    { value: 'results', label: '추첨 결과' },
    { value: 'verifications', label: '정합성 검증' },
    { value: 'candidates', label: '후보 명단' },
    { value: 'operations', label: '운영 이력' },
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

// AD02 실행 상세 — 실행 요약, 실패·재시도 정보, 취소 근거, 결과(당첨 취소 진입),
// 재추첨 시작·재개(AD09), 최초 발표(GD-199), 공개 반영(AD06), 운영 이력(GD-137)
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
    const [firstPublishOpen, setFirstPublishOpen] = useState(false);
    const start = useStartRedraw();
    const resumeInitial = useResumeDraw();
    const queryClient = useQueryClient();
    // 상세가 폴링으로 상태를 바꾸면 목록의 상태 칩도 같이 맞춘다 — 둘은 별도 쿼리다
    useEffect(() => {
        void queryClient.invalidateQueries({ queryKey: [...DRAWS_KEY, 'list'] });
    }, [queryClient, run.status]);
    const status = DRAW_RUN_STATUS_META[run.status];
    const isRedraw = run.drawType === 'REPLACEMENT';
    const confirmed = run.status === 'CONFIRMED';
    const inProgress = isDrawRunInProgress(run.status);

    // 이벤트의 실행 목록 — 최신 실행 판정(최초 발표는 최신 실행으로만 요청한다, GD-199)과
    // 취소 원본 결과가 있는 더 이른 실행의 식별에 쓴다
    const { data: runList } = useEventDraws(run.eventId, { page: 1, size: RUN_LIST_PAGE_SIZE });
    const isLatestRun = runList?.items[0]?.id === run.id;
    const earlierRunIds = (runList?.items ?? [])
        .filter((r) => r.runNumber < run.runNumber)
        .map((r) => r.id);
    const earlierRuns = useDrawRuns(earlierRunIds);

    // 이 실행에 없는 취소 원본 결과 — 더 이른 실행을 뒤져 찾아야 한다
    const missingResultIds = useMemo(() => {
        const own = new Set(run.results.map((r) => r.id));
        return [...new Set(run.execution.cancellations.map((c) => c.resultId))].filter(
            (id) => !own.has(id),
        );
    }, [run]);
    // 탐색 결과는 시작한 실행에 묶는다 — 실행을 바꾸면 이전 실행의 결과가 섞이지 않는다
    const [earlierSearch, setEarlierSearch] = useState<{
        runId: string;
        results: DrawResult[];
        done: boolean;
        failed: boolean;
    }>({ runId: run.id, results: [], done: false, failed: false });
    const searchedResults = useMemo(
        () => (earlierSearch.runId === run.id ? earlierSearch.results : []),
        [earlierSearch, run.id],
    );
    const earlierSearchDone = earlierSearch.runId === run.id && earlierSearch.done;
    const earlierSearchFailed = earlierSearch.runId === run.id && earlierSearch.failed;
    const searchingRef = useRef(false);

    // 첫 페이지(최신 100개)의 상세에서 못 찾은 취소 원본은 더 이른 실행 페이지를 순차 조회해 찾는다.
    // 취소 근거에는 원본 실행 ID가 없고 resultId뿐이라 실행 상세를 하나씩 확인해야 한다
    useEffect(() => {
        if (!runList || earlierSearchDone || earlierSearchFailed || searchingRef.current) return;
        if (earlierRuns.some((q) => q.isPending)) return;
        const known = new Set(run.results.map((r) => r.id));
        for (const q of earlierRuns) for (const r of q.data?.results ?? []) known.add(r.id);
        for (const r of searchedResults) known.add(r.id);
        const remaining = new Set(missingResultIds.filter((id) => !known.has(id)));
        // 모두 찾았으면 뒤질 필요가 없다 — resultIndex가 이미 판정할 수 있다
        if (remaining.size === 0) return;
        searchingRef.current = true;
        let cancelled = false;
        const found: DrawResult[] = [];
        const runId = run.id;
        const eventId = run.eventId;
        const runNumber = run.runNumber;
        const totalPages = Math.ceil(runList.totalElements / RUN_LIST_PAGE_SIZE);
        void (async () => {
            try {
                for (let page = 2; page <= totalPages && remaining.size > 0 && !cancelled; page++) {
                    const list = await queryClient.fetchQuery({
                        queryKey: [
                            ...DRAWS_KEY,
                            'list',
                            eventId,
                            { page, size: RUN_LIST_PAGE_SIZE },
                        ],
                        queryFn: () =>
                            fetchEventDrawsPage(eventId, { page, size: RUN_LIST_PAGE_SIZE }),
                    });
                    for (const item of list.items) {
                        if (item.runNumber >= runNumber) continue;
                        const detail = await queryClient.fetchQuery(drawRunOptions(item.id));
                        if (cancelled) return;
                        for (const r of detail.results) {
                            if (remaining.delete(r.id)) found.push(r);
                        }
                        if (remaining.size === 0) break;
                    }
                }
                if (cancelled) return;
                setEarlierSearch({ runId, results: found, done: true, failed: false });
            } catch {
                if (!cancelled) {
                    setEarlierSearch({ runId, results: found, done: false, failed: true });
                }
            } finally {
                searchingRef.current = false;
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [
        runList,
        earlierRuns,
        searchedResults,
        missingResultIds,
        earlierSearchDone,
        earlierSearchFailed,
        run,
        queryClient,
    ]);

    // 취소 근거의 resultId가 가리키는 원본 결과를 이 실행과 더 이른 실행에서 찾는다
    const resultIndex = new Map<string, DrawResult>();
    for (const other of earlierRuns) {
        for (const r of other.data?.results ?? []) resultIndex.set(r.id, r);
    }
    for (const r of searchedResults) resultIndex.set(r.id, r);
    for (const r of run.results) resultIndex.set(r.id, r);
    // 취소한 원본 결과가 최초 발표 이후 공개된 적이 있는지 — 발표 후 취소·재추첨인지 구분한다
    const publicationOf = (resultId: string) => {
        const result = resultIndex.get(resultId);
        if (result) return result.wasPublished ? ('after' as const) : ('before' as const);
        if (earlierRuns.some((q) => q.isError) || earlierSearchFailed) return 'error' as const;
        // 이전 실행을 끝까지 뒤졌는데도 없으면 서버 데이터 불일치다 — 반영을 막는다
        if (earlierSearchDone) return 'error' as const;
        return 'loading' as const;
    };
    const publicationStates = run.execution.cancellations.map((c) => publicationOf(c.resultId));
    const anyBeforeFirstPublication = publicationStates.includes('before');
    const stillLoading = publicationStates.includes('loading');
    const publicationCheckFailed = publicationStates.includes('error');

    // 최초 발표 여부 — 공개 명단 변경 이력(AD07)이 하나라도 있으면 발표된 이벤트다.
    // 조회 실패는 미공개로 오판하면 안 된다 — 이미 발표된 이벤트에 최초 발표를 보내면 PUBLICATION-005다
    const {
        data: changePage,
        isPending: changePending,
        isError: changeError,
        refetch: refetchChanges,
    } = useResultChanges(run.eventId, {
        page: 1,
        size: 1,
    });
    const firstPublished = (changePage?.totalElements ?? 0) > 0;

    const selectedResults = run.results.filter((r) => r.resultType === 'SELECTED');
    const alreadyPublished =
        selectedResults.length > 0 && selectedResults.every((r) => r.wasPublished);
    // 공개 전에 취소된 결과가 남은 실행을 반영하면 공개 명단에 빈 자리가 생긴다 — 취소의 재추첨 결과로 반영한다
    const hasUnpublishedCanceledResult = selectedResults.some(
        (r) => r.isCanceled && !r.wasPublished,
    );

    // 최초 발표(GD-199) — 이벤트가 공개되지 않았고 이 실행이 최신·확정일 때만 연다
    const canFirstPublish =
        !changePending &&
        !changeError &&
        !firstPublished &&
        isLatestRun &&
        confirmed &&
        !eventCanceled &&
        eventReady;
    // 공개 후 재추첨 반영(AD06) — 최초 발표 전에는 호출하지 않는다
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
                <Field label="구분">{DRAW_TYPE_LABEL[run.drawType]}</Field>
                <Field label="후보 고정">
                    {run.snapshotFixedAt ? formatKst(run.snapshotFixedAt) : '—'} · 같은 실행을
                    재시도하면 고정된 명단·조건을 그대로 씁니다
                </Field>
                <Field label="시작 / 확정">
                    {run.startedAt ? formatKst(run.startedAt) : '—'} /{' '}
                    {run.confirmedAt ? formatKst(run.confirmedAt) : '—'}
                </Field>
                <Field label="알고리즘">{run.algorithmVersion ?? '—'}</Field>

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

            {run.execution.latestFailure && (
                <section
                    aria-labelledby="draw-run-failure-title"
                    className="bg-surface-page border-border-default flex flex-col gap-3 rounded-2xl border p-6"
                >
                    <h3 id="draw-run-failure-title" className="text-body-bold text-fg-primary">
                        실패 정보
                    </h3>
                    <Field label="실패 코드">{run.execution.latestFailure.failureCode}</Field>
                    <Field label="안내">{run.execution.latestFailure.message}</Field>
                    <Field label="실패 횟수">{run.execution.failureCount}회</Field>
                    <Field label="마지막 실패">
                        {formatKst(run.execution.latestFailure.failedAt)}
                        {run.execution.latestFailure.traceId &&
                            ` · 추적 ${run.execution.latestFailure.traceId}`}
                    </Field>
                    {/* 재시도 예약과 운영자 대기를 구분한다 — retryAt이 없고 FAILED이면 waitingForOperator다 */}
                    {run.execution.retryAt && (
                        <p className="text-body-sm text-fg-secondary">
                            서버가 {formatKst(run.execution.retryAt)}에 자동으로 다시 시도할
                            예정입니다.
                        </p>
                    )}
                    {run.execution.waitingForOperator && (
                        <p className="text-body-sm text-fg-secondary">
                            자동 재시도가 예약되지 않아 운영자 확인이 필요합니다. 같은 실행을 재개할
                            수 있습니다.
                        </p>
                    )}
                    <p className="text-caption text-fg-tertiary">
                        복구·재시도·취소 전환 기준은 <PolicyPendingChip /> 상태입니다. 같은 실행의
                        재개(AD09)만 제공합니다.
                    </p>
                </section>
            )}

            {run.execution.cancellations.length > 0 && (
                <section
                    aria-labelledby="draw-run-cancel-title"
                    className="bg-surface-page border-border-default flex flex-col gap-4 rounded-2xl border p-6"
                >
                    <h3 id="draw-run-cancel-title" className="text-body-bold text-fg-primary">
                        당첨 취소 근거
                    </h3>
                    <ul className="flex flex-col gap-3">
                        {run.execution.cancellations.map((c, index) => {
                            const state = publicationStates[index];
                            return (
                                <li
                                    key={c.id}
                                    className="border-border-default flex flex-col gap-1 rounded-xl border p-4"
                                >
                                    <p className="text-body-sm text-fg-primary">{c.reason}</p>
                                    <p className="text-caption text-fg-tertiary">
                                        {c.canceledBy} · {formatKst(c.canceledAt)} · 취소 ID {c.id}
                                        {c.replacementRunId &&
                                            ` · 재추첨 실행 ${c.replacementRunId}`}
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
                                            onClick={() => {
                                                for (const q of earlierRuns) void q.refetch();
                                                // 이전 페이지 탐색이 실패해 낸 오류도 다시 돌린다
                                                setEarlierSearch({
                                                    runId: run.id,
                                                    results: [],
                                                    done: false,
                                                    failed: false,
                                                });
                                            }}
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

            {!changePending && !firstPublished && (
                <section
                    aria-labelledby="draw-run-first-publish-title"
                    className="bg-surface-page border-border-default flex flex-col gap-3 rounded-2xl border p-6"
                >
                    <div className="flex items-center gap-3">
                        <h3
                            id="draw-run-first-publish-title"
                            className="text-body-bold text-fg-primary"
                        >
                            최초 발표
                        </h3>
                        {isLatestRun && !changeError && (
                            <Button
                                size="sm"
                                disabled={!canFirstPublish}
                                onClick={() => setFirstPublishOpen(true)}
                            >
                                최초 발표
                            </Button>
                        )}
                    </div>
                    {changeError ? (
                        <div className="flex items-center gap-3">
                            <p role="alert" className="text-semantic-error-strong text-body-sm">
                                공개 명단 변경 이력을 불러오지 못해 발표 여부를 확인할 수 없습니다.
                            </p>
                            <Button
                                size="sm"
                                variant="secondary"
                                onClick={() => void refetchChanges()}
                            >
                                다시 시도
                            </Button>
                        </div>
                    ) : !isLatestRun ? (
                        <p className="text-body-sm text-fg-secondary">
                            최초 발표는 가장 최근 실행으로만 요청할 수 있습니다. 실행 목록에서 최신
                            실행을 선택해 주세요.
                        </p>
                    ) : !confirmed ? (
                        <p className="text-body-sm text-fg-secondary">
                            이 실행이 확정되면 결과를 검토하고 최초 발표할 수 있습니다.
                        </p>
                    ) : (
                        <p className="text-body-sm text-fg-secondary">
                            이 실행의 결과를 검토한 뒤 발표 버튼 한 번으로 확인·공개가 함께
                            확정됩니다. 발표 전까지 사용자에게 결과가 공개되지 않습니다.
                        </p>
                    )}
                </section>
            )}

            {firstPublished && isRedraw && (
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
                    {confirmed && !publicationCheckFailed && anyBeforeFirstPublication && (
                        <p className="text-body-sm text-fg-secondary">
                            최초 공개 전 취소가 포함돼 이 API(AD06)로 반영할 수 없습니다. 최초 공개
                            전 재추첨은 최초 발표 요청으로 함께 공개됩니다.
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
                open={firstPublishOpen}
                onOpenChange={setFirstPublishOpen}
            />
        </div>
    );
}
