/**
 * 포인터가 올라가 있는 행의 번호. 목록 위아래로 벗어나면 첫 행·끝 행으로 붙인다.
 *
 * 행 하나에 온전히 들어왔을 때만 자리를 내주므로, 경계에서 두 자리를 오가며 떨리지 않는다.
 */
export function rowIndexAt(
    rows: readonly { top: number; bottom: number }[],
    pointerY: number,
): number | null {
    if (rows.length === 0) return null;

    const first = rows[0]!;
    const last = rows[rows.length - 1]!;
    if (pointerY < first.top) return 0;
    if (pointerY > last.bottom) return rows.length - 1;

    const index = rows.findIndex((row) => pointerY >= row.top && pointerY <= row.bottom);
    return index === -1 ? null : index;
}

/** 한 칸을 다른 자리로 옮긴 목록. 제자리면 받은 목록을 그대로 돌려준다 */
export function moveItem<T>(items: readonly T[], from: number, to: number): T[] {
    if (from === to || from < 0 || from >= items.length || to < 0 || to >= items.length) {
        return [...items];
    }

    const next = [...items];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved as T);
    return next;
}

/** 두 목록이 같은 순서인지 — 바뀐 게 없으면 서버로 보내지 않는다 */
export function sameOrder(a: readonly { id: string }[], b: readonly { id: string }[]): boolean {
    return a.length === b.length && a.every((item, index) => item.id === b[index]?.id);
}
