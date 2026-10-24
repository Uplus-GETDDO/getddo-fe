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
const HEAD = 'text-fg-tertiary h-11 px-4 text-xs font-semibold';

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
                            <TableHead className={HEAD}>회차</TableHead>
                            <TableHead className={HEAD}>상태</TableHead>
                            <TableHead className={HEAD}>시각</TableHead>
                            <TableHead className={HEAD}>
                                <span className="sr-only">상세</span>
                            </TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {data.items.map((run) => {
                            const status = DRAW_RUN_STATUS_META[run.status];
                            const selected = run.id === selectedId;
                            return (
                                // 줄 어디를 눌러도 상세가 열린다 — 키보드는 오른쪽 '보기' 버튼으로 같은 길을 간다
                                <TableRow
                                    key={run.id}
                                    aria-selected={selected}
                                    onClick={() => onSelect(run.id)}
                                    className={cn(
                                        'hover:bg-surface-sunken focus-within:bg-surface-sunken cursor-pointer',
                                        selected && 'bg-surface-canvas',
                                    )}
                                >
                                    <TableCell className="px-4 py-3">
                                        <span className="text-body-sm-bold text-fg-primary block">
                                            {run.runNumber}회차
                                        </span>
                                        <span className="text-caption text-fg-tertiary">
                                            {DRAW_TYPE_LABEL[run.drawType]}
                                        </span>
                                    </TableCell>
                                    <TableCell className="px-4 py-3">
                                        <span
                                            className={cn(
                                                CHIP,
                                                'whitespace-nowrap',
                                                status.chipClass,
                                            )}
                                        >
                                            {status.label}
                                        </span>
                                    </TableCell>
                                    <TableCell className="px-4 py-3 whitespace-nowrap tabular-nums">
                                        <span className="text-body-sm text-fg-primary block">
                                            {run.confirmedAt
                                                ? `선정 ${formatKst(run.confirmedAt)}`
                                                : '선정 전'}
                                        </span>
                                        <span className="text-caption text-fg-tertiary">
                                            생성 {formatKst(run.createdAt)}
                                        </span>
                                    </TableCell>
                                    <TableCell className="px-4 py-3 text-right">
                                        <Button
                                            size="sm"
                                            variant={selected ? 'primary' : 'secondary'}
                                            aria-label={`${run.runNumber}회차 상세 보기`}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                onSelect(run.id);
                                            }}
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
