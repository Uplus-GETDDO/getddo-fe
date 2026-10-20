import { useEffect, useState } from 'react';

import { useNotificationList } from '@entities/notification';

/**
 * 알림 번호 페이지 — 서버는 커서 방식(ADR-0009)이라, 받은 쪽(커서 묶음)을 1쪽·2쪽…으로 쌓아 두고 번호로 넘긴다.
 * 아직 받지 않은 쪽으로 뛰면 서버가 준 nextCursor를 차례로 따라가 그 쪽까지 받는다 — 커서를 만들거나 해석하지 않는다.
 * 전체 쪽 수는 응답의 totalElements로 센다. 거르기(isRead)가 바뀌면 1쪽으로 돌아간다
 */
export function useNotificationPage({
    isRead,
    size,
    refetchOnMount,
}: {
    isRead?: boolean;
    size: number;
    refetchOnMount?: 'always';
}) {
    const query = useNotificationList({ isRead, size, refetchOnMount });
    const [state, setState] = useState({ isRead, page: 1 });
    // 거르기가 바뀌면 렌더 단계에서 바로 1쪽으로 (effect setState는 lint 금지)
    if (state.isRead !== isRead) setState({ isRead, page: 1 });
    const requested = state.isRead === isRead ? state.page : 1;

    const pages = query.data?.pages ?? [];
    const totalElements = pages[0]?.totalElements ?? 0;
    const totalPages = Math.max(1, Math.ceil(totalElements / size));
    // 알림이 줄어 쪽 수가 줄면 마지막 쪽에 맞춘다
    const page = Math.min(requested, totalPages);

    const { hasNextPage, isFetchingNextPage, isFetchNextPageError, fetchNextPage } = query;
    const loaded = pages.length;
    useEffect(() => {
        // 실패하면 멈추고 '다시 시도'를 기다린다 — 실패를 되풀이해 요청을 쏟지 않는다
        if (
            page > loaded &&
            loaded > 0 &&
            hasNextPage &&
            !isFetchingNextPage &&
            !isFetchNextPageError
        )
            void fetchNextPage();
    }, [page, loaded, hasNextPage, isFetchingNextPage, isFetchNextPageError, fetchNextPage]);

    return {
        query,
        page,
        totalPages,
        totalElements,
        setPage: (next: number) => setState({ isRead, page: next }),
        /** 지금 쪽의 알림 — 그 쪽을 아직 받는 중이면 undefined */
        items: pages[page - 1]?.items,
        /** 지금 쪽을 받으러 커서를 따라가는 중 */
        // 다음 커서가 없으면 더 받을 게 없다 — 합계(totalElements)와 커서가 어긋나도 뼈대만 남지 않고 빈 쪽으로 넘어간다
        pageLoading: page > loaded && hasNextPage && !isFetchNextPageError,
        /** 지금 쪽을 받지 못함 */
        pageError: page > loaded && isFetchNextPageError,
        retryPage: () => void fetchNextPage(),
    };
}
