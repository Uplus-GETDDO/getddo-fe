import { createContext } from 'react';

/** 모달 아래 고정 칸 — 공개 바를 스크롤 영역 밖에 붙이려고 본문 깊은 곳에서 이 칸으로 옮겨 그린다 */
export const FooterSlot = createContext<HTMLElement | null>(null);
