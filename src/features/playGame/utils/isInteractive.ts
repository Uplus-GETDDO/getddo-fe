/** 키 입력이 버튼·입력칸 같은 조작 요소에서 일어났는지 — 그때는 게임 키 처리를 하지 않고 그 요소에 맡긴다 */
export const isInteractive = (target: EventTarget | null) =>
    target instanceof HTMLElement &&
    (target.isContentEditable || !!target.closest('button, a, input, textarea, select'));
