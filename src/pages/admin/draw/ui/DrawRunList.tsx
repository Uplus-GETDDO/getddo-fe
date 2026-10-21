import { useState } from 'react';

import {
    DRAW_RUN_STATUS_META,
    DRAW_TYPE_LABEL,
    isDrawRunInProgress,
    useEventDraws,
} from '@entities/drawResult';
import { badgeVariants } from '@shared/ui/badge';
import { Button } from '@shared/ui/button';
import { LoadingBlock, TableSkeleton } from '@shared/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@shared/ui/table';
import { cn } from '@shared/utils/cn';
import { formatKst } from '@shared/utils/date';

import { PagedFooter } from './PagedFooter';

export const DRAW_RUN_PAGE_SIZE = 10;
// 상태·분류 칩 — 사용자 화면과 같은 공용 배지 모양(둥근 알약, 높이 26·글자 12)에 색만 칩마다 입힌다
const CHIP = badgeVariants({ variant: null });

interface DrawRunListProps {
    eventId: string;
    selectedId: string | null;
    onSelect: (drawId: string) => void;
}

// AD01 — 이벤트의 추첨 실행 목록. 서버에서 선정 중인 실행이 있으면 realtime 주기로 갱신된다
export function DrawRunList({ eventId, selectedId, onSelect }: DrawRunListProps) {
    const [page, setPage] = useState(1);
    const { data, isPending, isError, isFetching, refetch } = useEventDraws(eventId, {
        page,
        size: DRAW_RUN_PAGE_SIZE,
    });

    if (isPending) {
        return (
            <LoadingBlock>
                <TableSkeleton rows={4} />
            </LoadingBlock>
        );
    }
    if (isError) {
        return (
            <div className="flex items-center gap-3">
                <p role="alert" className="text-semantic-error-strong text-body-sm">
                    추첨 실행 목록을 불러오지 못했습니다.
                </p>
                <Button size="sm" variant="secondary" onClick={() => void refetch()}>
                    다시 시도
                </Button>
            </div>
        );
    }
    if (data.items.length === 0) {
        return (
            <p className="text-fg-secondary text-body-sm py-4">
                아직 추첨 실행이 없습니다. 마감 + 1분부터 자동 추첨 대상이 되고, 선정이 시작되면
                이곳에 표시됩니다.
            </p>
        );
    }

    const inProgress = data.items.some((run) => isDrawRunInProgress(run.status));

    return (
        <div className="flex flex-col gap-3">
            {inProgress && (
                <div className="flex items-center gap-3">
                    <p className="text-body-sm text-fg-secondary" role="status">
                        서버에서 당첨자를 선정하고 있습니다. 30초마다 자동으로 확인합니다.
                    </p>
                    <Button
                        size="sm"
                        variant="secondary"
                        disabled={isFetching}
                        onClick={() => void refetch()}
                    >
                        지금 확인
                    </Button>
                </div>
            )}
            <div className="bg-surface-page border-border-default overflow-hidden rounded-2xl border">
                <Table>
                    <TableHeader>
                        <TableRow className="hover:bg-transparent">
                            <TableHead className="text-caption text-fg-tertiary h-11 px-4">
                                회차
                            </TableHead>
                            <TableHead className="text-caption text-fg-tertiary h-11 px-4">
                                구분
                            </TableHead>
                            <TableHead className="text-caption text-fg-tertiary h-11 px-4 text-center">
                                상태
                            </TableHead>
                            <TableHead className="text-caption text-fg-tertiary h-11 px-4">
                                생성
                            </TableHead>
                            <TableHead className="text-caption text-fg-tertiary h-11 px-4">
                                선정 완료
                            </TableHead>
                            <TableHead className="text-caption text-fg-tertiary h-11 px-4">
                                상세
                            </TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {data.items.map((run) => {
                            const status = DRAW_RUN_STATUS_META[run.status];
                            const selected = run.id === selectedId;
                            return (
                                <TableRow
                                    key={run.id}
                                    aria-selected={selected}
                                    className={cn(
                                        'hover:bg-surface-sunken focus-within:bg-surface-sunken',
                                        selected && 'bg-surface-canvas',
                                    )}
                                >
                                    <TableCell className="text-body-sm px-4 py-3 font-medium">
                                        {run.runNumber}회차
                                    </TableCell>
                                    <TableCell className="text-body-sm text-fg-secondary px-4 py-3">
                                        {DRAW_TYPE_LABEL[run.drawType]}
                                    </TableCell>
                                    <TableCell className="px-4 py-3 text-center">
                                        <span className={cn(CHIP, status.chipClass)}>
                                            {status.label}
                                        </span>
                                    </TableCell>
                                    <TableCell className="text-body-sm text-fg-secondary px-4 py-3 whitespace-nowrap">
                                        {formatKst(run.createdAt)}
                                    </TableCell>
                                    <TableCell className="text-body-sm text-fg-secondary px-4 py-3 whitespace-nowrap">
                                        {run.confirmedAt ? formatKst(run.confirmedAt) : '—'}
                                    </TableCell>
                                    <TableCell className="px-4 py-3">
                                        <Button
                                            size="sm"
                                            variant={selected ? 'primary' : 'secondary'}
                                            aria-label={`${run.runNumber}회차 상세 보기`}
                                            onClick={() => onSelect(run.id)}
                                        >
                                            보기
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            );
                        })}
                    </TableBody>
                </Table>
            </div>
            <PagedFooter
                page={page}
                size={DRAW_RUN_PAGE_SIZE}
                totalElements={data.totalElements}
                onPageChange={setPage}
            />
        </div>
    );
}
