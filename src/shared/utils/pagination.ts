export type PageItem = number | 'ellipsis-start' | 'ellipsis-end';

/** 번호를 모두 보이는 최대 페이지 수 — 이보다 많으면 앞뒤를 … 로 접는다 */
const MAX_VISIBLE = 7;

/**
 * 번호형 페이지네이션에 그릴 칸 — 1부터 센다. 첫·끝 페이지는 늘 보이고, 현재 페이지 앞뒤 한 칸씩 둔다.
 * 예) 총 10쪽에서 2쪽 → 1 2 3 4 5 … 10, 6쪽 → 1 … 5 6 7 … 10
 */
export function pageItems(page: number, totalPages: number): PageItem[] {
    if (totalPages <= MAX_VISIBLE) return Array.from({ length: totalPages }, (_, i) => i + 1);
    if (page <= 4) return [1, 2, 3, 4, 5, 'ellipsis-end', totalPages];
    if (page >= totalPages - 3) {
        return [1, 'ellipsis-start', ...Array.from({ length: 5 }, (_, i) => totalPages - 4 + i)];
    }
    return [1, 'ellipsis-start', page - 1, page, page + 1, 'ellipsis-end', totalPages];
}

/**
 * 받아 둔 목록을 번호 쪽으로 자른다 — page는 1부터 센다.
 * 줄이 줄어 쪽 수가 줄면 마지막 쪽에 맞춘다 (빈 쪽을 보이지 않는다)
 */
export function pageSlice<T>(items: readonly T[], page: number, size: number) {
    const totalPages = Math.max(1, Math.ceil(items.length / size));
    const current = Math.min(Math.max(1, page), totalPages);
    return {
        items: items.slice((current - 1) * size, current * size),
        current,
        totalPages,
    };
}
