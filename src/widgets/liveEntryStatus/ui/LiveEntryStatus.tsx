import { Gift, Ticket, UsersRound } from 'lucide-react';

import { useEntryStatistics } from '@entities/entry';
import { getPollingRetryDelay } from '@shared/api/queryPresets';
import { Badge } from '@shared/ui/badge';
import { RefreshStatus } from '@shared/ui/refresh-status';
import { formatNumber } from '@shared/utils/format';

interface LiveEntryStatusProps {
    eventId: string;
    /** 응모 진행 중(open) 이벤트인가 — true일 때만 30초 폴링한다 (ADR-0007) */
    isOpen: boolean;
    /** 여러 이벤트가 겹쳐 보이는 곳(홈 배너)에서 현재 보이는 항목만 true로 둔다 */
    enabled?: boolean;
}

// CONTEXT.md — 실시간 현황에는 응모자 수·총 차감 응모권 수·본인 차감 수까지만 표시하고 당첨 확률은 노출하지 않는다.
// 홈 배너에서는 본인 차감 수 칩을 두지 않는다 — 배너는 아직 응모하지 않은 사람을 부르는 자리다
export function LiveEntryStatus({
    eventId,
    isOpen,
    enabled = true,
    winnerCount,
}: LiveEntryStatusProps & {
    /** 당첨 인원 — 응모를 정하는 데 가장 먼저 보는 값이라 맨 앞에 둔다 */
    winnerCount?: number;
}) {
    const { data } = useEntryStatistics(eventId, { isOpen, enabled });

    if (!enabled) {
        return null;
    }

    return (
        // 칩 줄 높이를 먼저 잡아 둔다 — 받기 전·실패해 값이 없을 때도 아래 버튼이 들썩이지 않는다.
        // 받는 중·실패 안내는 버튼 옆 갱신 표시(LiveEntryRefresh)가 맡고, 실패해도 받아 둔 수치는 그대로 둔다
        <div className="flex min-h-6.5 flex-wrap items-center gap-2" aria-live="polite">
            {data && (
                <>
                    {winnerCount != null && (
                        <Badge variant="accent" size="md" className="gap-2.5">
                            <Gift className="size-5" />
                            당첨 {formatNumber(winnerCount)}명
                        </Badge>
                    )}
                    <Badge variant="accent" size="md" className="gap-2.5">
                        <UsersRound className="size-5" />
                        {formatNumber(data.participantCount)}명 참여 중
                    </Badge>
                    <Badge variant="accent" size="md" className="gap-2.5">
                        <Ticket className="size-5" />
                        {formatNumber(data.totalSpentTicketCount)}장 사용
                    </Badge>
                </>
            )}
        </div>
    );
}

/**
 * 응모 현황 갱신 표시 — 30초 폴링 중임을 작게 알리고, 실패하면 이전 수치를 둔 채 '갱신 실패 · 다시 시도'로 바뀐다.
 * 같은 쿼리 키라 칩(LiveEntryStatus)과 요청은 한 번만 나간다. 서버가 기다리라고 하면(429) 그동안 다시 받지 않는다
 */
export function LiveEntryRefresh({ eventId, isOpen, enabled = true }: LiveEntryStatusProps) {
    const query = useEntryStatistics(eventId, { isOpen, enabled });
    const rateLimited = getPollingRetryDelay(query.error ?? query.failureReason) > 0;

    if (!enabled) {
        return null;
    }

    return (
        <RefreshStatus
            fetching={query.isFetching && !rateLimited}
            updatedAt={query.dataUpdatedAt || undefined}
            error={query.isError || rateLimited}
            interval={isOpen ? '30초마다' : undefined}
            onRefresh={() => {
                if (!rateLimited) void query.refetch({ cancelRefetch: false });
            }}
        />
    );
}
