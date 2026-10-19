import { useRef, useState } from 'react';

import { Button } from '@shared/ui/button';
import { formatKst } from '@shared/utils/date';

import type { useMyEntryRows } from '../hooks/useMyEntryRows';

/** 전체 집계의 기준과 부분 갱신 상태를 행 링크 밖에서 안내한다. */
export function MyEntryRefreshStatus({ query }: { query: ReturnType<typeof useMyEntryRows> }) {
    const [isRefreshing, setIsRefreshing] = useState(false);
    const refreshingRef = useRef(false);
    const refresh = async () => {
        if (refreshingRef.current) return;
        refreshingRef.current = true;
        setIsRefreshing(true);
        try {
            await query.refetch();
        } finally {
            refreshingRef.current = false;
            setIsRefreshing(false);
        }
    };
    return (
        <div className="text-body-sm text-fg-secondary flex flex-wrap items-center gap-2">
            <p role="status">
                {query.isRateLimited
                    ? '서버 요청 제한으로 대기 중이에요. 대기 시간이 지나면 다시 조회해요.'
                    : query.isResultPending
                      ? '응모 결과를 처음 불러오고 있어요.'
                      : query.isResultInitialError
                        ? '일부 응모 결과를 처음 불러오지 못했어요. 해당 결과는 집계에서 빠질 수 있어요.'
                        : query.isResultRefreshError || query.isEntriesRefreshError
                          ? '일부 응모 갱신에 실패했어요. 마지막으로 받은 값을 표시해요.'
                          : isRefreshing
                            ? '응모 결과를 갱신하고 있어요.'
                            : '전체 결과 집계는 각 응모의 마지막 조회 기준이에요.'}
            </p>
            {query.oldestResultUpdatedAt !== undefined && (
                <p>
                    {' '}
                    조회된 결과 중 가장 오래된 성공 시각:{' '}
                    {formatKst(new Date(query.oldestResultUpdatedAt).toISOString(), {
                        month: 'numeric',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                    })}
                    .
                </p>
            )}
            <Button variant="secondary" disabled={isRefreshing} onClick={() => void refresh()}>
                전체 응모 다시 조회
            </Button>
        </div>
    );
}
