import { AdminStatSummary } from '@widgets/adminStatSummary';

import { useTicketTrend } from './hooks/useTicketTrend';
import { ActionQueuePanel } from './ui/ActionQueuePanel';
import { EventStagePanel } from './ui/EventStagePanel';
import { OpenEventsPanel } from './ui/OpenEventsPanel';
import { TicketTrendPanel } from './ui/TicketTrendPanel';

/**
 * 관리자 대시보드 — 위에 오늘 숫자, 가운데 추이 그래프와 지금 처리할 일, 그 아래 운영 단계 분포·이벤트 응모 현황 표,
 * 그래프는 최근 7일 고정이다
 */
export function AdminDashboardPage() {
    const { rows, trend } = useTicketTrend();

    return (
        <div className="flex flex-col gap-6 pb-10 md:pr-10">
            <p className="text-body-sm text-fg-secondary">
                운영 중 확인이 잦은 지표를 모았습니다. 카드를 눌러 각 관리 화면으로 이동하세요.
            </p>
            <AdminStatSummary />
            <div className="grid gap-4 lg:grid-cols-3">
                <TicketTrendPanel
                    rows={rows}
                    isPending={trend.isPending}
                    isError={trend.isError}
                    onRetry={trend.refetch}
                    className="lg:col-span-2"
                />
                <ActionQueuePanel />
            </div>
            <div className="grid gap-4 lg:grid-cols-3">
                <EventStagePanel />
                <OpenEventsPanel className="lg:col-span-2" />
            </div>
        </div>
    );
}
