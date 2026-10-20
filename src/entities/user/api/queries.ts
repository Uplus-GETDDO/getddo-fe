import { useQuery } from '@tanstack/react-query';

import { getVirtualUsers } from '../model/virtualUsers';

export const VIRTUAL_USERS_KEY = ['virtual-users'] as const;

// 시연 계정 목록은 배포 설정(VITE_VIRTUAL_USERS_JSON)이 공급한다 — 서버 호출이 없고
// 설정 누락·형식 오류는 재시도로 회복되지 않으므로 retry: false다
export function useVirtualUsers() {
    return useQuery({
        queryKey: VIRTUAL_USERS_KEY,
        queryFn: getVirtualUsers,
        staleTime: Number.POSITIVE_INFINITY,
        retry: false,
    });
}
