import { QueryClient } from '@tanstack/react-query';

// TanStack Query 기본 옵션은 이 파일 한 곳에서 관리한다
export const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            staleTime: 30_000,
            retry: 1,
            refetchOnWindowFocus: false,
            // 탭이 숨겨진 동안 주기 재조회는 멈춘다 — 복귀 시 재마운트·다음 주기가
            // stale 데이터를 다시 받으므로 최신성은 유지된다
            refetchIntervalInBackground: false,
        },
        mutations: {
            retry: 0,
        },
    },
});
