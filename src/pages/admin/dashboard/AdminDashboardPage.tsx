import { RefreshStatus } from '@shared/ui/refresh-status';
import { AdminStatSummary } from '@widgets/adminStatSummary';

import { useDashboardRefresh } from './model/useDashboardRefresh';
import { useParticipationTrend } from './model/useParticipationTrend';
import { ActionQueuePanel } from './ui/ActionQueuePanel';
import { EventStagePanel } from './ui/EventStagePanel';
import { OpenEventsPanel } from './ui/OpenEventsPanel';
import { ParticipationTrendPanel } from './ui/ParticipationTrendPanel';
import { RecentAuditLogsPanel } from './ui/RecentAuditLogsPanel';

/**
 * 관리자 대시보드 — 위에 오늘 숫자, 가운데 활동 참여율 추이와 지금 처리할 일, 그 아래 운영 단계 분포·이벤트 응모 현황 표,
 * 맨 아래 최근 운영 기록. 그래프는 최근 7일 고정이다
 */
export function AdminDashboardPage() {
    const { rows, total, trend } = useParticipationTrend();
    const refresh = useDashboardRefresh();

    return (
        <div className="flex flex-col gap-6 pb-10 md:pr-10">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-body-sm text-fg-secondary">
                    운영 중 확인이 잦은 지표를 모았습니다. 카드를 눌러 각 관리 화면으로 이동하세요.
                </p>
                {/* 진행 중 이벤트·추첨은 30초마다, 나머지 숫자는 1분 캐시 — 누르면 화면 전체를 바로 다시 받는다 */}
                <RefreshStatus
                    fetching={refresh.fetching}
                    updatedAt={refresh.updatedAt}
                    error={refresh.error}
                    onRefresh={refresh.refresh}
                />
            </div>
            <AdminStatSummary />
            <div className="grid gap-4 lg:grid-cols-3">
                <ParticipationTrendPanel
                    rows={rows}
                    total={total}
                    isPending={trend.isPending}
                    isError={trend.isError}
                    hasData={trend.hasData}
                    onRetry={trend.refetch}
                    className="lg:col-span-2"
                />
                <ActionQueuePanel />
            </div>
            <div className="grid gap-4 lg:grid-cols-3">
                <EventStagePanel />
                <OpenEventsPanel className="lg:col-span-2" />
            </div>
            <RecentAuditLogsPanel />
        </div>
    );
}
