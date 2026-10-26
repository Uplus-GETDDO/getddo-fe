import { useQuery } from '@tanstack/react-query';

import { getVirtualUsers } from '../model/virtualUsers';

export const VIRTUAL_USERS_KEY = ['virtual-users'] as const;

// 시연 계정 목록은 배포 설정(VITE_VIRTUAL_USERS_JSON)이 공급한다 — 서버 호출이 없고
// 설정 누락·형식 오류는 재시도로 회복되지 않으므로 retry: false다.
// 동기 데이터라 pending 프레임은 스켈레톤→목록 교체 레이아웃 이동만 만든다 (GD-342, CLS/LCP).
// initialData로 첫 렌더부터 목록을 그리고, 파싱 실패는 undefined로 두어 queryFn이 던지는
// 기존 오류 경로(isError → 설정 안내 문구)를 그대로 탄다.
export function useVirtualUsers() {
    return useQuery({
        queryKey: VIRTUAL_USERS_KEY,
        queryFn: getVirtualUsers,
        initialData: () => {
            try {
                return getVirtualUsers();
            } catch {
                return undefined;
            }
        },
        staleTime: Number.POSITIVE_INFINITY,
        retry: false,
    });
}
