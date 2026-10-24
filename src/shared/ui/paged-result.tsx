import type { ReactNode } from 'react';

import { RotateCw } from 'lucide-react';

import { Button } from '@shared/ui/button';
import { Pagination } from '@shared/ui/pagination';
import { LoadingBlock, TableSkeleton } from '@shared/ui/skeleton';
import { formatKst } from '@shared/utils/date';

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
    toolbar,
    updatedAt,
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
    /** 총 건수 줄 오른쪽에 둘 보조 조작 — 예: 한 번에 보기 개수 */
    toolbar?: ReactNode;
    /** 마지막으로 받아 온 시각(쿼리 dataUpdatedAt) — 총 건수 옆에 '14:32 기준'으로 띄워 지금 보는 목록이 언제 것인지 알린다 */
    updatedAt?: number;
    children: (items: T[]) => ReactNode;
}) {
    const totalPages = data ? Math.max(1, Math.ceil(data.totalElements / data.size)) : 0;

    return (
        <div className="flex flex-col gap-4">
            {/* 총 건수는 목록 위에 — 검색 결과가 몇 건인지 먼저 보고 목록을 읽는다. 재조회 중에도 자리를 지킨다 */}
            <div className="flex min-h-9 flex-wrap items-center justify-between gap-3">
                <p className="flex items-center" aria-live="polite">
                    <span className="text-body-bold text-fg-primary tabular-nums">
                        {data ? `총 ${data.totalElements.toLocaleString('ko-KR')}${countUnit}` : ''}
                    </span>
                    {!isPending && isFetching && !isError ? (
                        <span role="status" className="text-caption text-fg-tertiary ml-2">
                            새로 확인하는 중…
                        </span>
                    ) : (
                        data &&
                        updatedAt !== undefined &&
                        updatedAt > 0 && (
                            <span className="text-caption text-fg-tertiary ml-2 flex items-center gap-1 tabular-nums">
                                {formatKst(new Date(updatedAt), {
                                    hour: '2-digit',
                                    minute: '2-digit',
                                    second: '2-digit',
                                    hour12: false,
                                })}{' '}
                                기준
                                {onRetry && (
                                    <button
                                        type="button"
                                        aria-label="목록 새로 고침"
                                        onClick={onRetry}
                                        className="text-fg-tertiary hover:text-fg-primary hover:bg-surface-sunken focus-visible:ring-border-focus flex size-6 cursor-pointer items-center justify-center rounded-full focus-visible:ring-2 focus-visible:outline-none"
                                    >
                                        <RotateCw aria-hidden className="size-3.5" />
                                    </button>
                                )}
                            </span>
                        )
                    )}
                </p>
                {toolbar}
            </div>
            {isPending &&
                (loadingContent ?? (
                    <LoadingBlock>
                        <TableSkeleton rows={4} />
                    </LoadingBlock>
                ))}
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
            {data && totalPages > 1 && (
                <div className="flex justify-center">
                    <Pagination
                        page={page}
                        totalPages={totalPages}
                        onPageChange={onPageChange}
                        jump={totalPages > 7}
                    />
                </div>
            )}
        </div>
    );
}

export { PagedResult };
