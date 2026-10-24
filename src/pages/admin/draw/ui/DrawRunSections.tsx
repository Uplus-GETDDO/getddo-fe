import type { DrawResult, DrawRunDetail } from '@entities/drawResult';

import { DRAW_RUN_STATUS_META, DRAW_TYPE_LABEL, isDrawRunInProgress } from '@entities/drawResult';
import { Button } from '@shared/ui/button';
import { RefreshStatus } from '@shared/ui/refresh-status';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@shared/ui/table';
import { cn } from '@shared/utils/cn';
import { formatKst } from '@shared/utils/date';

import { CHIP } from '../model/chip';
import { Field, ResultChips } from './DrawRunParts';
import { PolicyPendingChip } from './PolicyPendingNotice';

type RosterRow = { result: DrawResult; runNumber: number };
type PublicationState = 'loading' | 'after' | 'before' | 'error';

interface SummarySectionProps {
    run: DrawRunDetail;
    firstPublished: boolean;
    eventCanceled: boolean;
    eventReady: boolean;
    inProgress: boolean;
    refreshing: boolean;
    updatedAt: number;
    refreshFailed: boolean;
    onRefresh: () => void;
    startError: string | null;
    resumeError: string | null;
    hasActions: boolean;
    canResumeInitial: boolean;
    canResume: boolean;
    resumeInitialPending: boolean;
    startPending: boolean;
    onResumeFirstRun: () => void;
    onResume: () => void;
}

export function DrawRunSummarySection({
    run,
    firstPublished,
    eventCanceled,
    eventReady,
    inProgress,
    refreshing,
    updatedAt,
    refreshFailed,
    onRefresh,
    startError,
    resumeError,
    hasActions,
    canResumeInitial,
    canResume,
    resumeInitialPending,
    startPending,
    onResumeFirstRun,
    onResume,
}: SummarySectionProps) {
    const status = DRAW_RUN_STATUS_META[run.status];
    const isRedraw = run.drawType === 'REPLACEMENT';
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
                    <Button size="sm" disabled={resumeInitialPending} onClick={onResumeFirstRun}>
                        {resumeInitialPending ? '요청 중…' : '최초 추첨 재개'}
                    </Button>
                )}
                {canResume && (
                    <Button size="sm" disabled={startPending} onClick={onResume}>
                        {startPending ? '요청 중…' : '재추첨 시작·재개'}
                    </Button>
                )}
            </div>
        </div>
    );

    return (
        <section
            aria-labelledby="draw-run-summary-title"
            className="bg-surface-page border-border-default flex flex-col gap-4 rounded-2xl border p-6"
        >
            <div className="flex flex-wrap items-center gap-3">
                <h3 id="draw-run-summary-title" className="text-body-bold text-fg-primary">
                    {run.runNumber}회차 {isRedraw ? '재추첨' : '최초 추첨'}
                </h3>
                <span className={cn(CHIP, status.chipClass)}>{status.label}</span>
                {firstPublished && (
                    <span className={cn(CHIP, 'bg-status-approved text-status-approved-text')}>
                        공개됨
                    </span>
                )}
                {!firstPublished && (
                    <span className={cn(CHIP, 'bg-surface-sunken text-fg-secondary')}>미공개</span>
                )}
                {actions && <div className="ml-auto">{actions}</div>}
            </div>

            <Field label="실행 ID">{run.id}</Field>
            <Field label="구분">{DRAW_TYPE_LABEL[run.drawType]}</Field>
            <Field label="후보 고정">
                {run.snapshotFixedAt ? formatKst(run.snapshotFixedAt) : '—'} · 같은 실행을
                재시도하면 고정된 명단·조건을 그대로 씁니다
            </Field>
            <Field label="시작 / 선정 완료">
                {run.startedAt ? formatKst(run.startedAt) : '—'} /{' '}
                {run.confirmedAt ? formatKst(run.confirmedAt) : '—'}
            </Field>
            <Field label="알고리즘">{run.algorithmVersion ?? '—'}</Field>

            {inProgress && (
                <div className="flex flex-wrap items-center gap-3">
                    <p role="status" className="text-body-sm text-fg-secondary">
                        {run.status === 'PREPARING'
                            ? '서버가 실행을 준비하고 있습니다.'
                            : '서버가 당첨자를 선정하고 있습니다.'}
                    </p>
                    <RefreshStatus
                        fetching={refreshing}
                        updatedAt={updatedAt}
                        error={refreshFailed}
                        errorLabel="상태 조회 실패"
                        onRefresh={onRefresh}
                        interval="30초마다 자동 확인"
                    />
                </div>
            )}
            {startError && (
                <p role="alert" className="text-semantic-error-strong text-body-sm">
                    {startError}
                </p>
            )}
            {resumeError && (
                <p role="alert" className="text-semantic-error-strong text-body-sm">
                    {resumeError}
                </p>
            )}
            {eventCanceled && (
                <p className="text-body-sm text-fg-secondary">
                    취소된 이벤트라 당첨 취소·재추첨·공개 갱신을 할 수 없습니다.
                </p>
            )}
            {!eventReady && (
                <p className="text-body-sm text-fg-secondary">
                    이벤트 정보를 확인하지 못해 당첨 취소·재추첨·공개 갱신을 사용할 수 없습니다.
                </p>
            )}
        </section>
    );
}

export function DrawRunFailureSection({ run }: { run: DrawRunDetail }) {
    if (!run.execution.latestFailure) return null;
    return (
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
                    서버가 {formatKst(run.execution.retryAt)}에 자동으로 다시 시도할 예정입니다.
                </p>
            )}
            {run.execution.waitingForOperator && (
                <p className="text-body-sm text-fg-secondary">
                    자동 재시도가 예약되지 않아 운영자 확인이 필요합니다. 같은 실행을 재개할 수
                    있습니다.
                </p>
            )}
            <p className="text-caption text-fg-tertiary">
                복구·재시도·취소 전환 기준은 <PolicyPendingChip /> 상태입니다. 같은 실행의
                재개(AD09)만 제공합니다.
            </p>
        </section>
    );
}

interface CancellationsSectionProps {
    run: DrawRunDetail;
    publicationStates: PublicationState[];
    onRunCreated: (drawId: string) => void;
    onRetryPublicationCheck: () => void;
}

export function DrawCancellationsSection({
    run,
    publicationStates,
    onRunCreated,
    onRetryPublicationCheck,
}: CancellationsSectionProps) {
    if (run.execution.cancellations.length === 0) return null;
    return (
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
                                {c.canceledByName ?? c.canceledBy} · {formatKst(c.canceledAt)} ·
                                취소 ID {c.id}
                            </p>
                            {/* 취소 근거에서 대체 재추첨 실행으로 바로 이동 — 같은 모달 안에서 상세가 바뀐다 */}
                            {c.replacementRunId && c.replacementRunId !== run.id && (
                                <Button
                                    size="sm"
                                    variant="secondary"
                                    className="self-start"
                                    onClick={() => onRunCreated(c.replacementRunId!)}
                                >
                                    재추첨 실행 보기
                                </Button>
                            )}
                            <p className="text-caption text-fg-secondary">
                                {state === 'loading' && '공개 이력 확인 중…'}
                                {state === 'after' && '공개 이후에 취소한 당첨입니다.'}
                                {state === 'before' && '공개 전에 취소한 당첨입니다.'}
                                {state === 'error' && '공개 이력을 불러오지 못했습니다.'}
                            </p>
                            {state === 'error' && (
                                <Button
                                    size="sm"
                                    variant="secondary"
                                    className="self-start"
                                    onClick={onRetryPublicationCheck}
                                >
                                    공개 이력 다시 확인
                                </Button>
                            )}
                        </li>
                    );
                })}
            </ul>
        </section>
    );
}

interface FirstPublishSectionProps {
    isLatestRun: boolean;
    confirmed: boolean;
    changePending: boolean;
    changeError: boolean;
    canFirstPublish: boolean;
    onOpen: () => void;
    onRetry: () => void;
}

export function DrawFirstPublishSection({
    isLatestRun,
    confirmed,
    changePending,
    changeError,
    canFirstPublish,
    onOpen,
    onRetry,
}: FirstPublishSectionProps) {
    if (changePending) return null;
    return (
        <section
            aria-labelledby="draw-run-first-publish-title"
            className="bg-surface-page border-border-default flex flex-col gap-3 rounded-2xl border p-6"
        >
            <div className="flex items-center gap-3">
                <h3 id="draw-run-first-publish-title" className="text-body-bold text-fg-primary">
                    당첨자 공개
                </h3>
                {isLatestRun && !changeError && (
                    <Button size="sm" disabled={!canFirstPublish} onClick={onOpen}>
                        당첨자 공개
                    </Button>
                )}
            </div>
            {changeError ? (
                <div className="flex items-center gap-3">
                    <p role="alert" className="text-semantic-error-strong text-body-sm">
                        공개 명단 변경 이력을 불러오지 못해 공개 여부를 확인할 수 없습니다.
                    </p>
                    <Button size="sm" variant="secondary" onClick={onRetry}>
                        다시 시도
                    </Button>
                </div>
            ) : !isLatestRun ? (
                <p className="text-body-sm text-fg-secondary">
                    당첨자 공개는 가장 최근 실행으로만 요청할 수 있습니다. 실행 목록에서 최신 실행을
                    선택해 주세요.
                </p>
            ) : !confirmed ? (
                <p className="text-body-sm text-fg-secondary">
                    이 실행의 선정이 완료되면 결과를 검토하고 당첨자 공개를 요청할 수 있습니다.
                </p>
            ) : (
                <p className="text-body-sm text-fg-secondary">
                    이 실행의 결과를 검토한 뒤 당첨자 공개 버튼 한 번으로 확인·공개가 함께
                    확정됩니다. 공개 전까지 사용자에게 결과가 노출되지 않습니다.
                </p>
            )}
        </section>
    );
}

interface PublishUpdateSectionProps {
    confirmed: boolean;
    canPublish: boolean;
    alreadyPublished: boolean;
    publicationCheckFailed: boolean;
    anyBeforeFirstPublication: boolean;
    onOpen: () => void;
}

export function DrawPublishUpdateSection({
    confirmed,
    canPublish,
    alreadyPublished,
    publicationCheckFailed,
    anyBeforeFirstPublication,
    onOpen,
}: PublishUpdateSectionProps) {
    return (
        <section
            aria-labelledby="draw-run-publish-title"
            className="bg-surface-page border-border-default flex flex-col gap-3 rounded-2xl border p-6"
        >
            <div className="flex items-center gap-3">
                <h3 id="draw-run-publish-title" className="text-body-bold text-fg-primary">
                    공개 명단 갱신
                </h3>
                <Button size="sm" disabled={!canPublish} onClick={onOpen}>
                    공개 명단 갱신
                </Button>
            </div>
            {alreadyPublished && (
                <p className="text-body-sm text-fg-secondary">
                    이 재추첨 결과는 이미 공개 명단을 갱신했습니다.
                </p>
            )}
            {!confirmed && (
                <p className="text-body-sm text-fg-secondary">
                    재추첨의 선정이 완료되면 공개 명단을 갱신할 수 있습니다.
                </p>
            )}
            {confirmed && publicationCheckFailed && (
                <p className="text-body-sm text-fg-secondary">
                    취소한 원본 실행의 공개 이력을 불러오지 못했습니다. 확인이 끝날 때까지 공개
                    명단을 갱신할 수 없습니다.
                </p>
            )}
            {confirmed && !publicationCheckFailed && anyBeforeFirstPublication && (
                <p className="text-body-sm text-fg-secondary">
                    공개 전 취소가 포함돼 이 API(AD06)로 갱신할 수 없습니다. 공개 전 재추첨은 당첨자
                    공개 요청으로 함께 공개됩니다.
                </p>
            )}
            {confirmed && !anyBeforeFirstPublication && !alreadyPublished && (
                <p className="text-body-sm text-fg-secondary">
                    갱신 전까지 취소자 표시와 본인 중간 결과는 <PolicyPendingChip /> 입니다. 관리자
                    미확인 결과는 사용자에게 노출되지 않습니다.
                </p>
            )}
        </section>
    );
}

interface RosterSectionProps {
    firstPublished: boolean;
    rosterComplete: boolean;
    rosterLoading: boolean;
    rosterUnreadable: boolean;
    rosterRows: RosterRow[];
    publicationSummary: { winners: number; unfilled: number; canceled: number };
}

export function DrawRosterSection({
    firstPublished,
    rosterComplete,
    rosterLoading,
    rosterUnreadable,
    rosterRows,
    publicationSummary,
}: RosterSectionProps) {
    if (!rosterComplete) {
        return (
            <section
                aria-labelledby="draw-run-roster-title"
                className="bg-surface-page border-border-default flex flex-col gap-4 rounded-2xl border p-6"
            >
                <h3 id="draw-run-roster-title" className="text-body-bold text-fg-primary">
                    {firstPublished ? '공개 명단' : '공개 예정 최종 명단'}
                </h3>
                <p className="text-body-sm text-fg-secondary">
                    {rosterLoading
                        ? '실행 목록과 이전 실행 결과를 확인하는 중입니다.'
                        : rosterUnreadable
                          ? '모든 실행을 불러오지 못해 최종 명단을 확정할 수 없습니다.'
                          : '이 실행 이후에 다른 실행이 있어 이 실행만으로 최종 명단을 확정할 수 없습니다. 최신 실행을 선택해 주세요.'}
                </p>
            </section>
        );
    }
    if (rosterRows.length === 0) return null;
    return (
        <section
            aria-labelledby="draw-run-roster-title"
            className="bg-surface-page border-border-default flex flex-col gap-4 rounded-2xl border p-6"
        >
            <div className="flex flex-col gap-1">
                <h3 id="draw-run-roster-title" className="text-body-bold text-fg-primary">
                    {firstPublished ? '공개 명단' : '공개 예정 최종 명단'}
                </h3>
                <p className="text-caption text-fg-tertiary">
                    확정된 실행을 회차 순으로 합친 슬롯별 최종 상태입니다.
                    {!firstPublished && ' 공개 요청 전에 이 명단을 검토해 주세요.'}
                </p>
            </div>
            <p className="text-body-sm text-fg-primary">
                당첨 {publicationSummary.winners}명
                {publicationSummary.unfilled > 0 && ` · 미충원 ${publicationSummary.unfilled}자리`}
                {publicationSummary.canceled > 0 && ` · 취소 ${publicationSummary.canceled}자리`}
            </p>
            <Table>
                <TableHeader>
                    <TableRow className="hover:bg-transparent">
                        <TableHead>등수</TableHead>
                        <TableHead>슬롯</TableHead>
                        <TableHead>당첨자</TableHead>
                        <TableHead>구분</TableHead>
                        <TableHead>공개 이력</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {rosterRows.map(({ result, runNumber }) => (
                        <TableRow
                            key={`${result.prizeId}:${result.slotNumber}`}
                            className="hover:bg-transparent"
                        >
                            <TableCell>{result.prizeRank}등</TableCell>
                            <TableCell>{result.slotNumber}</TableCell>
                            <TableCell className="font-medium">
                                {result.userName ?? result.userId ?? '—'}
                                {result.userName && result.userId && (
                                    <span className="text-caption text-fg-secondary block font-normal">
                                        {result.userId}
                                    </span>
                                )}
                            </TableCell>
                            <TableCell>
                                {result.resultType === 'UNFILLED' ? (
                                    <span
                                        className={cn(CHIP, 'bg-surface-sunken text-fg-secondary')}
                                    >
                                        미충원
                                    </span>
                                ) : result.isCanceled ? (
                                    <span
                                        className={cn(
                                            CHIP,
                                            'bg-status-rejected text-status-rejected-text',
                                        )}
                                    >
                                        취소됨
                                    </span>
                                ) : runNumber > 1 ? (
                                    <span
                                        className={cn(
                                            CHIP,
                                            'bg-status-active text-status-active-text',
                                        )}
                                    >
                                        대체 선정
                                    </span>
                                ) : (
                                    <span
                                        className={cn(
                                            CHIP,
                                            'bg-status-approved text-status-approved-text',
                                        )}
                                    >
                                        선정
                                    </span>
                                )}
                            </TableCell>
                            <TableCell className="text-body-sm text-fg-secondary">
                                {result.wasPublished ? '공개됨' : '미공개'}
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </section>
    );
}

interface ResultsSectionProps {
    run: DrawRunDetail;
    cancelable: boolean;
    onCancelResult: (result: DrawResult) => void;
}

export function DrawResultsSection({ run, cancelable, onCancelResult }: ResultsSectionProps) {
    const inProgress = isDrawRunInProgress(run.status);
    return (
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
                                    {result.userName ?? result.userId ?? '—'}
                                    {result.userName && result.userId && (
                                        <span className="text-caption text-fg-secondary block font-normal">
                                            {result.userId}
                                        </span>
                                    )}
                                </TableCell>
                                <TableCell>
                                    <ResultChips result={result} />
                                </TableCell>
                                <TableCell>
                                    {result.resultType === 'SELECTED' && !result.isCanceled && (
                                        <Button
                                            size="sm"
                                            variant="secondary"
                                            disabled={!cancelable}
                                            aria-label={`${result.slotNumber}번 슬롯 당첨 취소`}
                                            onClick={() => onCancelResult(result)}
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
    );
}
