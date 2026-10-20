import { useIsFetching, useQueryClient } from '@tanstack/react-query';

/**
 * 대시보드 전체의 새로고침 상태 — 화면에 떠 있는 조회들을 한데 모아 하나의 표시로 보인다.
 * 칸마다 표시를 달면 어수선해서, 받는 중·마지막 갱신·실패 여부를 페이지 위 한 곳에서 알린다
 */
export function useDashboardRefresh() {
    const queryClient = useQueryClient();
    // 받는 중인 조회 수가 바뀔 때마다 다시 그려진다 — 그때 캐시에서 갱신 시각·실패를 읽는다
    const fetching = useIsFetching() > 0;
    const active = queryClient.getQueryCache().findAll({ type: 'active' });
    const updatedAt = Math.max(0, ...active.map((query) => query.state.dataUpdatedAt));

    return {
        fetching,
        updatedAt: updatedAt || undefined,
        // 다시 받기에 실패한 조회가 있는가 — 실패해도 이전 값은 남고, 칸은 내용을 둔 채 작게 알린다
        error: active.some((query) => query.state.status === 'error'),
        refresh: () => void queryClient.refetchQueries({ type: 'active' }),
    };
}
