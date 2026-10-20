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
