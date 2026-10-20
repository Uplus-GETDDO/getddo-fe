import { useAdminDailyStats } from '@entities/adminStats';
import { useVirtualClock } from '@shared/model/virtualClock';
import { recentKstDays } from '@shared/utils/date';
import { AdminStatSummary } from '@widgets/adminStatSummary';

import { TREND_DAYS, toTrendRows } from './hooks/useTicketTrend';
import { ActionQueuePanel } from './ui/ActionQueuePanel';
import { EventStagePanel } from './ui/EventStagePanel';
import { OpenEventsPanel } from './ui/OpenEventsPanel';
import { TicketTrendPanel } from './ui/TicketTrendPanel';

/**
 * 관리자 대시보드 — 위에 오늘 숫자, 가운데 추이 그래프와 지금 처리할 일, 그 아래 운영 단계 분포·이벤트 응모 현황 표.
 * 요약·추이는 같은 AS01 일별 집계(최근 7일, KST)를 나눠 쓴다 — 조건별 목록 조회로 건수를 세지 않는다.
 * AS01은 서버 저장 데이터 조회일 뿐 관리자 가상 시계가 서버 시간을 바꾸지는 않는다
 */
export function AdminDashboardPage() {
    const days = recentKstDays(useVirtualClock().now(), TREND_DAYS);
    const stats = useAdminDailyStats({
        from: days[0]!.ymd,
        to: days[days.length - 1]!.ymd,
    });
    const rows = toTrendRows(stats.data?.days ?? []);

    return (
        <div className="flex flex-col gap-6 pb-10 md:pr-10">
            <p className="text-body-sm text-fg-secondary">
                운영 중 확인이 잦은 지표를 모았습니다. 카드를 눌러 각 관리 화면으로 이동하세요.
            </p>
            <AdminStatSummary stats={stats} />
            <div className="grid gap-4 lg:grid-cols-3">
                <TicketTrendPanel
                    rows={rows}
                    isPending={stats.isPending}
                    isError={stats.isError}
                    onRetry={() => void stats.refetch()}
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
