import { useAdminDailyStats } from '@entities/adminStats';
import { useAdminEvents } from '@entities/event';
import { useVirtualClock } from '@shared/model/virtualClock';
import { formatKst, recentKstDays } from '@shared/utils/date';
import { AdminStatSummary } from '@widgets/adminStatSummary';

import { TREND_DAYS, toTrendRows } from './hooks/useTicketTrend';
import { ActionQueuePanel } from './ui/ActionQueuePanel';
import { EventStagePanel } from './ui/EventStagePanel';
import { OpenEventsPanel } from './ui/OpenEventsPanel';
import { TicketTrendPanel } from './ui/TicketTrendPanel';

/** 진행 중 이벤트는 최대치(100)로 받아 패널별로 마감 순·임박 필터를 적용한다 */
const OPEN_EVENTS_SIZE = 100;

/**
 * 관리자 대시보드 — 위에 오늘 숫자, 가운데 추이 그래프와 지금 처리할 일, 그 아래 운영 단계 분포·이벤트 응모 현황 표.
 * 요약·추이는 같은 AS01 일별 집계(최근 7일, KST)를 나눠 쓴다 — 조건별 목록 조회로 건수를 세지 않는다.
 * AS01은 서버 저장 데이터 조회일 뿐 관리자 가상 시계가 서버 시간을 바꾸지는 않는다
 */
export function AdminDashboardPage() {
    const now = useVirtualClock().now();
    const days = recentKstDays(now, TREND_DAYS);
    const stats = useAdminDailyStats({
        from: days[0]!.ymd,
        to: days[days.length - 1]!.ymd,
    });
    const rows = toTrendRows(stats.data?.days ?? []);
    // 진행 중 이벤트 목록은 페이지가 구독해 응모 현황 표에 넘긴다
    const openEvents = useAdminEvents({ page: 1, size: OPEN_EVENTS_SIZE, status: 'OPEN' });

    return (
        <div className="flex flex-col gap-5 pb-10 md:pr-10">
            {/* 제목 아래 작은 날짜 줄 — 숫자들이 언제 기준인지 먼저 알린다 */}
            <p className="text-body-sm text-fg-tertiary -mt-1">
                {formatKst(now, {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                    weekday: 'long',
                })}{' '}
                · 최근 {TREND_DAYS}일 집계
            </p>
            <AdminStatSummary stats={stats} />
            <div className="grid gap-5 lg:grid-cols-3">
                <TicketTrendPanel
                    rows={rows}
                    isPending={stats.isPending}
                    isError={stats.isError}
                    onRetry={() => void stats.refetch()}
                    className="lg:col-span-2"
                />
                <ActionQueuePanel />
            </div>
            <div className="grid gap-5 lg:grid-cols-3">
                <EventStagePanel />
                <OpenEventsPanel className="lg:col-span-2" query={openEvents} />
            </div>
        </div>
    );
}
