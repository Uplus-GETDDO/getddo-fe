import { useCallback, useMemo, useState, type ReactNode } from 'react';

import { VirtualClockContext, type VirtualClockValue } from './context';
import { VIRTUAL_CLOCK_STORAGE_KEY } from './storageKey';

function readStoredOverride(): Date | null {
    try {
        // 같은 탭의 새로고침까지 오버라이드를 유지한다 — 새 탭/세션에서는 실제 시각으로 시작한다
        const raw = sessionStorage.getItem(VIRTUAL_CLOCK_STORAGE_KEY);
        if (!raw) return null;
        const at = new Date(raw);
        return Number.isNaN(at.getTime()) ? null : at;
    } catch {
        return null;
    }
}

// 렌더 중 외부 저장소 접근을 피하기 위해 모듈 로드 시 1회만 읽는다
const initialOverride = readStoredOverride();

export function VirtualClockProvider({ children }: { children: ReactNode }) {
    const [override, setOverrideState] = useState<Date | null>(initialOverride);

    const setOverride = useCallback((at: Date | null) => {
        try {
            if (at) {
                sessionStorage.setItem(VIRTUAL_CLOCK_STORAGE_KEY, at.toISOString());
            } else {
                sessionStorage.removeItem(VIRTUAL_CLOCK_STORAGE_KEY);
            }
        } catch {
            // 저장에 실패해도 인메모리 오버라이드로 동작한다
        }
        setOverrideState(at);
    }, []);

    const value = useMemo<VirtualClockValue>(
        () => ({
            now: () => override ?? new Date(),
            setOverride,
            override,
            isOverridden: override !== null,
        }),
        [override, setOverride],
    );

    return <VirtualClockContext.Provider value={value}>{children}</VirtualClockContext.Provider>;
}
