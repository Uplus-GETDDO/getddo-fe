import type { ReactNode } from 'react';

import { Button } from '@shared/ui/button';
import { Pagination } from '@shared/ui/pagination';
import { LoadingBlock, TableSkeleton } from '@shared/ui/skeleton';

interface PageData<T> {
    items: T[];
    size: number;
    totalElements: number;
}

// 탭마다 같은 로딩·오류·빈 목록·페이저 상태를 한 곳에서 그린다
function PagedResult<T>({
    data,
    isPending,
    isError,
    isFetching,
    page,
    onPageChange,
    emptyText,
    errorText,
    countUnit = '건',
    onRetry,
    emptyAction,
    loadingContent,
    children,
}: {
    data: PageData<T> | undefined;
    isPending: boolean;
    isError: boolean;
    /** 재조회 진행 중 — 기존 결과 위에 갱신 상태만 얹는다 */
    isFetching?: boolean;
    page: number;
    onPageChange: (page: number) => void;
    emptyText: string;
    errorText: string;
    /** 총 건수 표시의 단위 — 참여자처럼 사람 수를 셀 때 '명'을 넘긴다 */
    countUnit?: string;
    /** 조회 실패 시 '다시 시도' 버튼 — 생략하면 문구만 표시 */
    onRetry?: () => void;
    /** 빈 결과 아래에 붙는 다음 행동 — 예: 검색 조건 초기화 */
    emptyAction?: ReactNode;
    /** 초기 로딩 모양 — 생략 시 테이블형 스켈레톤. 재조회에는 나타나지 않는다 */
    loadingContent?: ReactNode;
    children: (items: T[]) => ReactNode;
}) {
    const totalPages = data ? Math.max(1, Math.ceil(data.totalElements / data.size)) : 0;

    return (
        <div className="flex flex-col gap-4">
            {isPending &&
                (loadingContent ?? (
                    <LoadingBlock>
                        <TableSkeleton rows={4} />
                    </LoadingBlock>
                ))}
            {!isPending && isFetching && !isError && (
                <p role="status" className="text-caption text-fg-tertiary">
                    목록을 새로 확인하는 중…
                </p>
            )}
            {isError && (
                <div className="flex items-center gap-3" role="alert">
                    <p className="text-semantic-error-strong text-body-sm">{errorText}</p>
                    {onRetry && (
                        <Button size="sm" variant="secondary" onClick={onRetry}>
                            다시 시도
                        </Button>
                    )}
                </div>
            )}
            {!isPending && !isError && data && data.items.length === 0 && (
                <div className="flex flex-col gap-2 py-6">
                    <p className="text-fg-secondary text-body-sm">{emptyText}</p>
                    {emptyAction}
                </div>
            )}
            {data && data.items.length > 0 && children(data.items)}
            {data && data.totalElements > 0 && (
                <div className="flex items-center justify-between">
                    <span className="text-body-sm text-fg-secondary" aria-live="polite">
                        총 {data.totalElements}
                        {countUnit}
                    </span>
                    <Pagination page={page} totalPages={totalPages} onPageChange={onPageChange} />
                </div>
            )}
        </div>
    );
}

export { PagedResult };
