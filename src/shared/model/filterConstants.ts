export const PAGE_SIZE = 20;

/** Select는 빈 값을 가질 수 없어 '전체'를 이 값으로 표현하고 쿼리에 넘길 때 뺀다 */
export const ALL = 'all';
export const orUndefined = (value: string) => (value === ALL || value === '' ? undefined : value);

/** YYYY-MM-DD 문자열 비교 — 시작일이 종료일보다 늦으면 false. 검색 적용 전 검증용 */
export const isDateRangeOrdered = (from: string, to: string) => !from || !to || from <= to;
