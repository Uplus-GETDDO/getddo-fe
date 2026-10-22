import { GameBoardButton } from './GameBoardButton';

/**
 * 색 버튼 하나 — 판 위 도트 버튼에 왼쪽 키보드 번호(키 모양) · 가운데 색 이름(그 색 글자).
 * 글자 크기는 판 너비(@container)에 맞춘다
 */
export function ColorWordButton({
    number,
    name,
    textClass,
    disabled,
    onPick,
}: {
    number: number;
    name: string;
    /** 이름 글자색 — 그 색으로 칠한다 */
    textClass: string;
    disabled: boolean;
    onPick: () => void;
}) {
    return (
        <GameBoardButton
            disabled={disabled}
            onClick={onPick}
            className="px-[9%] text-base font-extrabold @lg:text-2xl"
        >
            <span
                aria-hidden
                // 키 모양 — 아래 두꺼운 테두리 대신 그림자로 입체감을 준다 (호버 때 테두리 칠이 깨져 보이던 문제)
                className="border-fg-primary bg-surface-page relative isolate flex size-6 items-center justify-center rounded-md border-2 text-sm leading-none font-extrabold shadow-[0_3px_0_0_var(--color-fg-primary)] @lg:size-9 @lg:text-lg [@media(hover:none)]:invisible"
            >
                {number}
            </span>
            {/* 이름은 번호와 오른쪽 빈칸 사이의 가운데에 두고, 그 색으로 칠한다 */}
            <span className={`flex-1 text-center ${textClass}`}>{name}</span>
            {/* 오른쪽 빈칸(번호 폭의 절반) — 이름이 버튼 정가운데와 번호 옆 칸 가운데의 중간에 와서 어느 쪽으로도 치우쳐 보이지 않게 한다 */}
            <span aria-hidden className="w-3 shrink-0 @lg:w-4" />
        </GameBoardButton>
    );
}
