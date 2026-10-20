import { useState } from 'react';

import { useDrawExecutionAudits, useDrawFailures } from '@entities/drawResult';
import { Button } from '@shared/ui/button';
import { LoadingBlock, SkeletonRows } from '@shared/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@shared/ui/table';
import { formatKst } from '@shared/utils/date';

import { PagedFooter } from './PagedFooter';

const PAGE_SIZE = 10;

function QueryState({
    pending,
    error,
    onRetry,
}: {
    pending: boolean;
    error: boolean;
    onRetry: () => void;
}) {
    if (pending) {
        return (
            <LoadingBlock>
                <SkeletonRows rows={3} />
            </LoadingBlock>
        );
    }
    if (error) {
        return (
            <div className="flex items-center gap-3" role="alert">
                <p className="text-semantic-error-strong text-body-sm">
                    운영 이력을 불러오지 못했습니다.
                </p>
                <Button size="sm" variant="secondary" onClick={onRetry}>
                    다시 시도
                </Button>
            </div>
        );
    }
    return null;
}

// GD-137 — 실행의 실패 이력(/failures)과 실행 감사(/execution-audits)를 한 섹션에서 보여준다
export function DrawOperationsSection({ drawId }: { drawId: string }) {
    const [failurePage, setFailurePage] = useState(1);
    const [auditPage, setAuditPage] = useState(1);
    const failures = useDrawFailures(drawId, { page: failurePage, size: PAGE_SIZE });
    const audits = useDrawExecutionAudits(drawId, { page: auditPage, size: PAGE_SIZE });

    return (
        <div className="flex flex-col gap-6">
            <section
                aria-labelledby="draw-failures-title"
                className="bg-surface-page border-border-default flex flex-col gap-4 rounded-2xl border p-6"
            >
                <h3 id="draw-failures-title" className="text-body-bold text-fg-primary">
                    실패 이력
                </h3>
                <QueryState
                    pending={failures.isPending}
                    error={failures.isError}
                    onRetry={() => void failures.refetch()}
                />
                {failures.data && failures.data.items.length === 0 && (
                    <p className="text-body-sm text-fg-tertiary">이 실행의 실패 기록이 없습니다.</p>
                )}
                {failures.data && failures.data.items.length > 0 && (
                    <>
                        <Table>
                            <TableHeader>
                                <TableRow className="hover:bg-transparent">
                                    <TableHead>실패 코드</TableHead>
                                    <TableHead>안내</TableHead>
                                    <TableHead>실패 시각</TableHead>
                                    <TableHead>추적 ID</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {failures.data.items.map((f) => (
                                    <TableRow key={f.id} className="hover:bg-transparent">
                                        <TableCell className="text-body-sm font-medium whitespace-nowrap">
                                            {f.failureCode}
                                        </TableCell>
                                        <TableCell className="text-body-sm max-w-80 whitespace-normal">
                                            {f.message}
                                        </TableCell>
                                        <TableCell className="text-body-sm text-fg-secondary whitespace-nowrap">
                                            {formatKst(f.failedAt)}
                                        </TableCell>
                                        <TableCell className="text-body-sm text-fg-tertiary whitespace-nowrap">
                                            {f.traceId ?? '—'}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                        <PagedFooter
                            page={failurePage}
                            size={PAGE_SIZE}
                            totalElements={failures.data.totalElements}
                            onPageChange={setFailurePage}
                        />
                    </>
                )}
            </section>

            <section
                aria-labelledby="draw-audits-title"
                className="bg-surface-page border-border-default flex flex-col gap-4 rounded-2xl border p-6"
            >
                <h3 id="draw-audits-title" className="text-body-bold text-fg-primary">
                    실행 감사
                </h3>
                <QueryState
                    pending={audits.isPending}
                    error={audits.isError}
                    onRetry={() => void audits.refetch()}
                />
                {audits.data && audits.data.items.length === 0 && (
                    <p className="text-body-sm text-fg-tertiary">
                        이 실행의 업무 감사 기록이 없습니다.
                    </p>
                )}
                {audits.data && audits.data.items.length > 0 && (
                    <>
                        <Table>
                            <TableHeader>
                                <TableRow className="hover:bg-transparent">
                                    <TableHead>시각</TableHead>
                                    <TableHead>행위</TableHead>
                                    <TableHead>처리자</TableHead>
                                    <TableHead>사유</TableHead>
                                    <TableHead>요청 ID</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {audits.data.items.map((a) => (
                                    <TableRow key={a.id} className="align-top hover:bg-transparent">
                                        <TableCell className="text-body-sm text-fg-secondary whitespace-nowrap">
                                            {formatKst(a.createdAt)}
                                        </TableCell>
                                        <TableCell className="text-body-sm font-medium whitespace-nowrap">
                                            {a.action}
                                        </TableCell>
                                        <TableCell className="text-body-sm whitespace-nowrap">
                                            {a.actorId ?? '—'}
                                        </TableCell>
                                        <TableCell className="text-body-sm max-w-60 whitespace-normal">
                                            {a.reason ?? '—'}
                                            {/* beforeData/afterData는 JSON이 아닌 문자열 — 의미를 해석하지 않고 원문을 축약 표시한다 */}
                                            {(a.beforeData || a.afterData) && (
                                                <span className="text-caption text-fg-tertiary block">
                                                    {a.beforeData && `전 ${a.beforeData}`}
                                                    {a.beforeData && a.afterData && ' · '}
                                                    {a.afterData && `후 ${a.afterData}`}
                                                </span>
                                            )}
                                        </TableCell>
                                        <TableCell className="text-body-sm text-fg-tertiary whitespace-nowrap">
                                            {a.requestId ?? '—'}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                        <PagedFooter
                            page={auditPage}
                            size={PAGE_SIZE}
                            totalElements={audits.data.totalElements}
                            onPageChange={setAuditPage}
                        />
                    </>
                )}
            </section>
        </div>
    );
}
