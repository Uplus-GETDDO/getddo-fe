import { useSessionStore } from '@entities/user';
import { apiClient } from '@shared/api/client';
import { queryClient } from '@shared/api/queryClient';

// 확정 API 공통 사용자 문맥(getddo-spec/05-api/common.md) — BE 공통 처리 위치는 담당자 후속 작업이다
apiClient.interceptors.request.use((config) => {
    const user = useSessionStore.getState().user;
    if (user) {
        config.headers['X-User-ID'] = user.id;
        // 필수 헤더 — 서버가 DB 역할과 대조만 하며 헤더로 권한이 올라가지 않는다 (05-api/common.md)
        config.headers['X-User-Role'] = user.role;
        // 선택 헤더 — 보내면 서버가 DB 멤버십과 대조해 응모 자격을 판정한다 (05-api/common.md)
        // ADMIN은 보내지 않는다 — 멤버십이 없는 관리자와 대조하면 409 USER-006이 된다
        if (user.role !== 'ADMIN') {
            config.headers['X-User-Membership'] = user.membership;
        }
    }
    return config;
});

// 가상 사용자 전환은 컴포넌트 언마운트 없이 일어난다 — 이전 사용자의 /me 계열 데이터가
// 남지 않도록 전환 시점에 조회 캐시를 초기 상태로 되돌리고 활성 쿼리를 재조회한다
let previousUserId = useSessionStore.getState().user?.id;
useSessionStore.subscribe((state) => {
    const userId = state.user?.id;
    if (userId !== previousUserId) {
        previousUserId = userId;
        void queryClient.resetQueries();
    }
});
