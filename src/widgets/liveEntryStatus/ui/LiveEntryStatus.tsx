import { useEntryStatistics } from '@entities/entry';
import { getPollingRetryDelay } from '@shared/api/queryPresets';
import { Badge } from '@shared/ui/badge';
import { RefreshStatus } from '@shared/ui/refresh-status';
import { formatNumber } from '@shared/utils/format';

import chipParticipant from '../assets/chip-participant.png';
import chipTicket from '../assets/chip-ticket.png';
import chipWinner from '../assets/chip-winner.png';

/** 칩 앞 그림 — 미션 화면 출석·게임·설문퀴즈 칸과 같은 픽셀 그림. 글자가 뜻을 다 전하니 화면 낭독기는 건너뛴다 */
function ChipIcon({ src }: { src: string }) {
    return <img src={src} alt="" aria-hidden className="size-5 object-contain" />;
}

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
        // 칩은 흰 바탕 — 관리자 배너 그림 위에 얹혀 연노랑 칩은 그림 색과 섞였다. 앞에 작은 픽셀 그림(당첨·참여·응모권)을 둔다.
        // 왼쪽 위 마감 탭(Badge surface)과 같은 흰 알약이라 배너 위 표시가 한 가지 모양으로 모인다
        // 칩 줄 높이를 먼저 잡아 둔다 — 받기 전·실패해 값이 없을 때도 아래 버튼이 들썩이지 않는다.
        // 받는 중·실패 안내는 버튼 옆 갱신 표시(LiveEntryRefresh)가 맡고, 실패해도 받아 둔 수치는 그대로 둔다
        <div className="flex min-h-7 flex-wrap items-center gap-2" aria-live="polite">
            {data && (
                <>
                    {winnerCount != null && (
                        <Badge variant="surface" size="lg" className="pl-2 tabular-nums">
                            <ChipIcon src={chipWinner} />
                            당첨 {formatNumber(winnerCount)}명
                        </Badge>
                    )}
                    <Badge variant="surface" size="lg" className="pl-2 tabular-nums">
                        <ChipIcon src={chipParticipant} />
                        {formatNumber(data.participantCount)}명 참여 중
                    </Badge>
                    <Badge variant="surface" size="lg" className="pl-2 tabular-nums">
                        <ChipIcon src={chipTicket} />
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
