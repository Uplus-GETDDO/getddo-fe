import { useEffect, useRef } from 'react';

/**
 * 목록 + 상세 2열 화면에서, 칸이 세로로 쌓이는 좁은 폭일 때만 새로 연 상세로 스크롤한다.
 * 넓은 폭에서는 상세가 옆에 붙어 있어 스크롤하지 않는다 — 보던 목록 자리를 지킨다.
 * key: 열린 항목 id(바뀔 때마다 한 번), sideBySide: 두 칸이 나란히 서는 미디어 쿼리 (예: '(min-width: 1024px)')
 */
export function useRevealWhenStacked<T extends HTMLElement>(
    key: string | null | undefined,
    sideBySide: string,
) {
    const ref = useRef<T>(null);
    useEffect(() => {
        if (!key || window.matchMedia?.(sideBySide).matches) return;
        const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
        ref.current?.scrollIntoView?.({
            block: 'start',
            behavior: reduceMotion ? 'auto' : 'smooth',
        });
    }, [key, sideBySide]);
    return ref;
}
