/**
 * 배너 한 칸을 위/아래로 옮긴 뒤의 ID 순서를 돌려준다.
 * 경계를 넘거나 ID가 없으면 null이다 (요청을 보내지 않는다)
 */
export function moveBannerId(
    bannerIds: string[],
    bannerId: string,
    direction: 'up' | 'down',
): string[] | null {
    const from = bannerIds.indexOf(bannerId);
    const to = direction === 'up' ? from - 1 : from + 1;
    if (from < 0 || to < 0 || to >= bannerIds.length) return null;

    const next = [...bannerIds];
    [next[from], next[to]] = [next[to] as string, next[from] as string];
    return next;
}
