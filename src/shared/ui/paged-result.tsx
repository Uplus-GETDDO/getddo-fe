import type { ReactNode } from 'react';

import { Button } from '@shared/ui/button';
import { Pagination } from '@shared/ui/pagination';
import { RefreshStatus } from '@shared/ui/refresh-status';
import { LoadingBlock, TableSkeleton } from '@shared/ui/skeleton';
import { formatNumber } from '@shared/utils/format';

interface PageData<T> {
    items: T[];
    size: number;
    totalElements: number;
}

// 탭마다 같은 로딩·오류·빈 목록·페이저 상태를 한 곳에서 그린다 — 폴링·재조회 중에도 이전 목록을 유지한다
function PagedResult<T>({
    data,
    isPending,
    isError,
    isFetching,
    updatedAt,
    page,
    onPageChange,
    emptyText,
    errorText,
    onRetry,
    emptyAction,
    loadingContent,
    children,
}: {
    data: PageData<T> | undefined;
    isPending: boolean;
    isError: boolean;
    /** 재조회 진행 중 — 기존 결과는 두고 위 줄의 새로고침 상태만 바꾼다 */
    isFetching?: boolean;
    /** 마지막으로 받은 시각 — query.dataUpdatedAt */
    updatedAt?: number;
    page: number;
    onPageChange: (page: number) => void;
    emptyText: string;
    errorText: string;
    /** 조회 실패 시 '다시 시도' 버튼 — 생략하면 문구만 표시 */
    onRetry?: () => void;
    /** 빈 결과 아래에 붙는 다음 행동 — 예: 검색 조건 초기화 */
    emptyAction?: ReactNode;
    /** 초기 로딩 모양 — 생략 시 테이블형 스켈레톤. 재조회에는 나타나지 않는다 */
    loadingContent?: ReactNode;
    children: (items: T[]) => ReactNode;
}) {
    const totalPages = data ? Math.max(1, Math.ceil(data.totalElements / data.size)) : 0;
    const refresh = onRetry ?? (() => undefined);

    return (
        <div className="flex flex-col gap-4">
            {/* 위 줄 — 총 건수와 새로고침 상태. 받는 중·실패 안내가 이 자리에서 바뀌어 목록을 밀지 않는다 */}
            {data && (
                <div className="flex items-center justify-between gap-3">
                    <span className="text-body-sm text-fg-secondary" aria-live="polite">
                        총{' '}
                        <strong className="text-fg-primary tabular-nums">
                            {formatNumber(data.totalElements)}
                        </strong>
                        건
                    </span>
                    <RefreshStatus
                        fetching={Boolean(isFetching)}
                        updatedAt={updatedAt}
                        error={isError}
                        onRefresh={refresh}
                    />
                </div>
            )}
            {isPending &&
                (loadingContent ?? (
                    <LoadingBlock>
                        <TableSkeleton rows={4} />
                    </LoadingBlock>
                ))}
            {/* 처음부터 실패해 보여줄 것이 없을 때만 오류 안내로 바꾼다 — 이전 목록이 있으면 그대로 둔다 */}
            {isError && !data && (
                <div className="flex items-center gap-3" role="alert">
                    <p className="text-semantic-error-strong text-body-sm">{errorText}</p>
                    {onRetry && (
                        <Button size="sm" variant="secondary" onClick={onRetry}>
                            다시 시도
                        </Button>
                    )}
                </div>
            )}
            {data && data.items.length === 0 && (
                <div className="flex flex-col gap-2 py-6">
                    <p className="text-fg-secondary text-body-sm">{emptyText}</p>
                    {emptyAction}
                </div>
            )}
            {data && data.items.length > 0 && children(data.items)}
            {data && totalPages > 1 && (
                <Pagination
                    page={page}
                    totalPages={totalPages}
                    onPageChange={onPageChange}
                    className="self-end"
                />
            )}
        </div>
    );
}

export { PagedResult };
