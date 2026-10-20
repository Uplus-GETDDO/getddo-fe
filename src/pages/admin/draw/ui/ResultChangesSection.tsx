import { useState } from 'react';

import { useResultChanges } from '@entities/winner';
import { Button } from '@shared/ui/button';
import { LoadingBlock, SkeletonRows } from '@shared/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@shared/ui/table';
import { formatKst } from '@shared/utils/date';

import { PagedFooter } from './PagedFooter';

const PAGE_SIZE = 10;

// AD07 — 공개 버전 간 변경 대상·전후 정보·확인자·시각·사유
export function ResultChangesSection({ eventId }: { eventId: string }) {
    const [page, setPage] = useState(1);
    const { data, isPending, isError, refetch } = useResultChanges(eventId, {
        page,
        size: PAGE_SIZE,
    });

    return (
        <section
            aria-labelledby="result-changes-title"
            className="bg-surface-page border-border-default flex flex-col gap-4 rounded-2xl border p-6"
        >
            <h3 id="result-changes-title" className="text-body-bold text-fg-primary">
                공개 명단 변경 이력
            </h3>

            {isPending && (
                <LoadingBlock>
                    <SkeletonRows rows={3} />
                </LoadingBlock>
            )}
            {isError && (
                <div className="flex items-center gap-3" role="alert">
                    <p className="text-semantic-error-strong text-body-sm">
                        변경 이력을 불러오지 못했습니다.
                    </p>
                    <Button size="sm" variant="secondary" onClick={() => void refetch()}>
                        다시 시도
                    </Button>
                </div>
            )}
            {data && data.items.length === 0 && (
                <p className="text-body-sm text-fg-tertiary">
                    공개 명단이 갱신된 적이 없습니다. 재추첨 결과를 공개 명단에 반영하면 여기에
                    기록됩니다.
                </p>
            )}
            {data && data.items.length > 0 && (
                <>
                    <Table>
                        <TableHeader>
                            <TableRow className="hover:bg-transparent">
                                <TableHead>버전</TableHead>
                                <TableHead>변경 내용</TableHead>
                                <TableHead>사유</TableHead>
                                <TableHead>확인</TableHead>
                                <TableHead>실행 근거</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {data.items.map((change) => (
                                <TableRow
                                    key={change.id}
                                    className="align-top hover:bg-transparent"
                                >
                                    <TableCell className="font-medium whitespace-nowrap">
                                        v{change.revision}
                                    </TableCell>
                                    <TableCell>
                                        {change.changes.length === 0 ? (
                                            <span className="text-fg-tertiary">변경 없음</span>
                                        ) : (
                                            <ul className="flex flex-col gap-1">
                                                {change.changes.map((c) => (
                                                    <li
                                                        key={`${c.prizeId}:${c.slotNumber}`}
                                                        className="text-body-sm"
                                                    >
                                                        슬롯 {c.slotNumber} ·{' '}
                                                        <span className="text-fg-tertiary line-through">
                                                            {c.beforeUserId ?? '—'}
                                                        </span>{' '}
                                                        → <b>{c.afterUserId ?? '미충원'}</b>
                                                    </li>
                                                ))}
                                            </ul>
                                        )}
                                    </TableCell>
                                    {/* 과거 INITIAL 공개는 사유·확인자·시각이 없을 수 있어 null을 보존해 표시한다 */}
                                    <TableCell className="text-body-sm max-w-60 whitespace-normal">
                                        {change.reason ?? '—'}
                                    </TableCell>
                                    <TableCell className="text-body-sm text-fg-secondary whitespace-nowrap">
                                        {change.confirmedBy ?? '—'}
                                        <br />
                                        {change.confirmedAt ? formatKst(change.confirmedAt) : '—'}
                                    </TableCell>
                                    <TableCell className="text-body-sm max-w-72 whitespace-normal">
                                        {change.executions.length === 0 ? (
                                            <span className="text-fg-tertiary">근거 기록 없음</span>
                                        ) : (
                                            <ul className="flex flex-col gap-1.5">
                                                {change.executions.map((exec) => (
                                                    <li key={exec.runId}>
                                                        <span className="text-fg-secondary">
                                                            실행 {exec.runId} · 확인{' '}
                                                            {exec.confirmedBy} ·{' '}
                                                            {formatKst(exec.confirmedAt)}
                                                        </span>
                                                        {exec.cancellations.length > 0 && (
                                                            <ul className="text-caption text-fg-tertiary mt-0.5 flex list-disc flex-col gap-0.5 pl-4">
                                                                {exec.cancellations.map((c) => (
                                                                    <li key={c.id}>
                                                                        취소 {c.reason}
                                                                    </li>
                                                                ))}
                                                            </ul>
                                                        )}
                                                    </li>
                                                ))}
                                            </ul>
                                        )}
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                    <PagedFooter
                        page={page}
                        size={PAGE_SIZE}
                        totalElements={data.totalElements}
                        onPageChange={setPage}
                    />
                </>
            )}
        </section>
    );
}
