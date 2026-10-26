import { createContext, useContext } from 'react';

export interface VirtualClockValue {
    /** 오버라이드가 설정되어 있으면 그 시각, 아니면 실제 현재 시각을 반환 */
    now: () => Date;
    /** 관리자 시간 여행용 오버라이드. null을 넣으면 실제 시각으로 복귀 */
    setOverride: (at: Date | null) => void;
    /** 현재 적용 중인 오버라이드 시각. 없으면 null */
    override: Date | null;
    isOverridden: boolean;
}

export const VirtualClockContext = createContext<VirtualClockValue | null>(null);

export function useVirtualClock() {
    const ctx = useContext(VirtualClockContext);
    if (!ctx) {
        throw new Error('useVirtualClock은 VirtualClockProvider 안에서만 사용할 수 있습니다');
    }
    return ctx;
}
