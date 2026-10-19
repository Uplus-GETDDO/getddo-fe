import { Gift, Ticket, UsersRound } from 'lucide-react';

import { useEntryStatistics } from '@entities/entry';
import { getErrorMessage } from '@shared/api/errorMessage';
import { getPollingRetryDelay } from '@shared/api/queryPresets';
import { Badge } from '@shared/ui/badge';
import { Button } from '@shared/ui/button';
import { formatKst } from '@shared/utils/date';
import { formatNumber } from '@shared/utils/format';

interface LiveEntryStatusProps {
    eventId: string;
    /** 응모 진행 중(open) 이벤트인가 — true일 때만 30초 폴링한다 (ADR-0007) */
    isOpen: boolean;
    /** 여러 이벤트가 겹쳐 보이는 곳(홈 배너)에서 현재 보이는 항목만 true로 둔다 */
    enabled?: boolean;
    /** 당첨 인원 — 응모를 정하는 데 가장 먼저 보는 값이라 맨 앞에 둔다 */
    winnerCount?: number;
}

// CONTEXT.md — 실시간 현황에는 응모자 수·총 차감 응모권 수·본인 차감 수까지만 표시하고 당첨 확률은 노출하지 않는다.
// 홈 배너에서는 본인 차감 수 칩을 두지 않는다 — 배너는 아직 응모하지 않은 사람을 부르는 자리다
export function LiveEntryStatus({
    eventId,
    isOpen,
    enabled = true,
    winnerCount,
}: LiveEntryStatusProps) {
    const query = useEntryStatistics(eventId, { isOpen, enabled });
    const { data } = query;
    const error = query.error ?? query.failureReason;
    const rateLimited = getPollingRetryDelay(error) > 0;

    if (!enabled) {
        return null;
    }

    return (
        // 폴링으로 수치가 바뀌면 보조 기술에 조용히 알린다
        <div className="flex flex-wrap items-center gap-2" aria-live="polite">
            {!data && query.isPending && !rateLimited && (
                <span>응모 현황을 불러오는 중이에요.</span>
            )}
            {(query.isError || rateLimited) && (
                <div role="status" className="text-body-sm">
                    <p>
                        {data
                            ? '응모 현황을 갱신하지 못했어요. 이전 값을 표시해요.'
                            : '응모 현황을 불러오지 못했어요.'}
                    </p>
                    <p>{getErrorMessage(error)}</p>
                    {rateLimited && <p>요청이 많아요. 잠시 후 다시 시도해 주세요.</p>}
                    <Button
                        type="button"
                        variant="secondary"
                        disabled={query.isFetching}
                        onClick={() => {
                            if (getPollingRetryDelay(error) === 0)
                                void query.refetch({ cancelRefetch: false });
                        }}
                    >
                        응모 현황 다시 시도
                    </Button>
                </div>
            )}
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
                    <span className="text-body-sm">
                        마지막 조회{' '}
                        {formatKst(new Date(query.dataUpdatedAt), {
                            month: 'numeric',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                            second: '2-digit',
                        })}
                    </span>
                    {query.isFetching && (
                        <span className="text-body-sm">응모 현황 갱신 중이에요.</span>
                    )}

                    <Badge variant="accent" size="md" className="gap-2.5">
                        <Ticket className="size-5" />
                        {formatNumber(data.totalSpentTicketCount)}장 사용
                    </Badge>
                </>
            )}
        </div>
    );
}
