/**
 * 누른 자리가 그 자체로 쓰임이 있는 칸인지 본다.
 *
 * 줄이나 카드를 통째로 끌 수 있게 만들면 그 안의 버튼을 누르려던 손짓까지 끌기로 먹힌다.
 * 버튼·링크·입력 위에서 시작한 누름은 그 칸의 것으로 두라는 뜻이다.
 */
export function startsOnOwnControl(target: EventTarget | null): boolean {
    return (
        target instanceof Element && target.closest('button, a, input, select, textarea') !== null
    );
}
