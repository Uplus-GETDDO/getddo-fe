import { Clock } from 'lucide-react';
import { useRef, useState } from 'react';

import { RefreshStatus } from '@shared/ui/refresh-status';

import type { useMyEntryRows } from '../hooks/useMyEntryRows';

/**
 * 응모 결과 갱신 표시 — 홈·겟또타임과 같은 작은 한 줄('n분 전 갱신 / 새로 받는 중 / 갱신 실패 · 다시 시도').
 * 시각은 받아 둔 결과 중 가장 오래된 성공 시각이다 — 가장 늦게 갱신된 줄 기준이라 '방금'이 부풀려지지 않는다.
 * 받아 둔 결과는 실패해도 그대로 두고 이 표시로만 알린다. 누르면 응모와 결과를 모두 다시 받는다
 */
export function MyEntryRefreshStatus({
    query,
    className,
}: {
    query: ReturnType<typeof useMyEntryRows>;
    className?: string;
}) {
    const [isRefreshing, setIsRefreshing] = useState(false);
    // 버튼이 잠기기 전 연속 클릭도 한 번만 보낸다
    const refreshingRef = useRef(false);
    const refresh = async () => {
        if (refreshingRef.current) return;
        refreshingRef.current = true;
        setIsRefreshing(true);
        await query.refetch().finally(() => {
            refreshingRef.current = false;
            setIsRefreshing(false);
        });
    };

    // 429는 다시 눌러도 같은 답이라 버튼 대신 기다린다는 안내만 둔다 — 대기 시간이 지나면 폴링이 알아서 다시 받는다
    if (query.isRateLimited) {
        return (
            <span
                role="status"
                className={`text-caption text-fg-tertiary inline-flex h-7 shrink-0 items-center gap-1 px-2 whitespace-nowrap ${className ?? ''}`}
            >
                <Clock aria-hidden className="size-3" />
                요청이 많아 잠시 뒤 다시 받아요
            </span>
        );
    }

    return (
        <RefreshStatus
            // 폴링(백그라운드 조회)으로는 돌지 않는다 — 직접 누른 조회와 첫 결과 받기만 '받는 중'으로 보인다
            fetching={isRefreshing || query.isResultPending}
            updatedAt={query.oldestResultUpdatedAt}
            error={
                query.isResultInitialError ||
                query.isResultRefreshError ||
                query.isEntriesRefreshError
            }
            onRefresh={() => void refresh()}
            className={className}
        />
    );
}
