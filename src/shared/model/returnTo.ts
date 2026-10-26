import { useLocation } from 'react-router-dom';

/**
 * 다른 화면으로 건너갈 때 '돌아갈 곳'을 함께 넘긴다 — 링크의 state로 실어 보내고, 도착한 화면의 머리가 읽어
 * '← {label}로 돌아가기'를 띄운다. 주소(검색 조건·고른 줄 포함)를 그대로 담아 돌아오면 보던 자리가 그대로 열린다
 */
export interface ReturnTo {
    /** 돌아갈 주소 — pathname + search */
    to: string;
    /** 돌아갈 화면 이름 — 예: '이벤트 관리 · 닌텐도 스위치 2 래플' */
    label: string;
}

export interface ReturnState {
    returnTo: ReturnTo;
}

/** 지금 화면을 돌아올 곳으로 담은 링크 state — <Link state={useReturnState('이벤트 관리')}> */
export function useReturnState(label: string): ReturnState {
    const { pathname, search } = useLocation();
    return { returnTo: { to: `${pathname}${search}`, label } };
}

/** 이 화면에 실려 온 돌아갈 곳 — 없으면 null */
export function readReturnTo(state: unknown): ReturnTo | null {
    if (typeof state !== 'object' || state === null || !('returnTo' in state)) return null;
    const value = state.returnTo;
    if (typeof value !== 'object' || value === null) return null;
    const { to, label } = value as Partial<ReturnTo>;
    return typeof to === 'string' && typeof label === 'string' ? { to, label } : null;
}
