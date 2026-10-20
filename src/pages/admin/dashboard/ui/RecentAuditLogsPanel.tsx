import { ChevronRight } from 'lucide-react';
import { useState } from 'react';

import type { AuditLogSummary } from '@entities/audit';

import {
    auditActionLabel,
    AuditLogDetailDrawer,
    auditTargetTypeLabel,
    useAuditLogs,
} from '@entities/audit';
import { formatKst } from '@shared/lib/date';
import { formatNumber } from '@shared/lib/format';
import { LoadingBlock, SkeletonRows } from '@shared/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@shared/ui/table';

import { DashboardPanel } from './DashboardPanel';
import { ViewAllLink } from './ViewAllLink';

const PREVIEW_SIZE = 5;

/**
 * 최근 운영 기록 — 감사 로그 앞 5건을 표로. 줄을 누르면 상세 서랍이 열린다.
 * 감사 조회는 실서버 연동 전이라(공통 감사 AU01·AU02 제외) 연동 방식이 정해지면 정렬·문구를 다시 맞춘다
 */
export function RecentAuditLogsPanel() {
    const query = useAuditLogs({ page: 1, size: PREVIEW_SIZE });
    const [selected, setSelected] = useState<AuditLogSummary | null>(null);
    const items = query.data?.items ?? [];

    return (
        <DashboardPanel
            title="최근 운영 기록"
            caption={
                query.data
                    ? `기록된 운영 작업 ${formatNumber(query.data.totalElements)}건 중 ${items.length}건`
                    : '관리자가 한 작업을 기록해요'
            }
            actions={<ViewAllLink to="/admin/audit" />}
            error={query.isError}
            hasData={query.data !== undefined}
            onRetry={() => void query.refetch()}
        >
            {query.isPending ? (
                <LoadingBlock>
                    <SkeletonRows rows={3} />
                </LoadingBlock>
            ) : items.length === 0 ? (
                <p className="text-body-sm text-fg-tertiary py-6 text-center">
                    기록된 운영 작업이 없습니다.
                </p>
            ) : (
                <Table>
                    <TableHeader>
                        <TableRow className="hover:bg-transparent">
                            <TableHead className="text-fg-tertiary">시각</TableHead>
                            <TableHead className="text-fg-tertiary">작업</TableHead>
                            <TableHead className="text-fg-tertiary">대상</TableHead>
                            <TableHead className="text-fg-tertiary">처리자</TableHead>
                            <TableHead className="w-10">
                                <span className="sr-only">상세</span>
                            </TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {items.map((log) => (
                            <TableRow
                                key={log.id}
                                className="hover:bg-surface-sunken cursor-pointer"
                                onClick={() => setSelected(log)}
                            >
                                <TableCell className="text-body-sm text-fg-secondary tabular-nums">
                                    {formatKst(log.createdAt)}
                                </TableCell>
                                <TableCell className="text-body-sm-bold text-fg-primary">
                                    {/* 줄 클릭과 별개로 키보드·화면 낭독기용 버튼을 둔다 */}
                                    <button
                                        type="button"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setSelected(log);
                                        }}
                                        aria-label={`${auditActionLabel(log.action)} 기록 상세`}
                                        className="focus-visible:ring-border-focus rounded text-left focus-visible:ring-2 focus-visible:outline-none"
                                    >
                                        {auditActionLabel(log.action)}
                                    </button>
                                </TableCell>
                                <TableCell className="text-body-sm text-fg-secondary">
                                    {auditTargetTypeLabel(log.targetType)}
                                </TableCell>
                                <TableCell className="text-body-sm text-fg-secondary">
                                    {log.actorId ?? '시스템'}
                                </TableCell>
                                <TableCell>
                                    <ChevronRight aria-hidden className="text-fg-tertiary size-4" />
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            )}

            <AuditLogDetailDrawer
                summary={selected}
                open={selected !== null}
                onOpenChange={(open) => {
                    if (!open) setSelected(null);
                }}
            />
        </DashboardPanel>
    );
}
