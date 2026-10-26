import { describe, expect, it } from 'vitest';

import { moveItem, rowIndexAt, sameOrder } from './dropOrder';

// 높이 40인 행 셋
const rows = [
    { top: 0, bottom: 40 },
    { top: 40, bottom: 80 },
    { top: 80, bottom: 120 },
];

describe('rowIndexAt', () => {
    it('올라가 있는 행을 돌려준다', () => {
        expect(rowIndexAt(rows, 10)).toBe(0);
        expect(rowIndexAt(rows, 55)).toBe(1);
        expect(rowIndexAt(rows, 119)).toBe(2);
    });

    /* 표 밖으로 끌고 나가도 끌던 칸이 허공에 머물지 않게 양 끝으로 붙인다 */
    it('목록 위아래를 벗어나면 첫 행·끝 행이다', () => {
        expect(rowIndexAt(rows, -999)).toBe(0);
        expect(rowIndexAt(rows, 999)).toBe(2);
    });

    it('행이 없으면 가리킬 자리도 없다', () => {
        expect(rowIndexAt([], 10)).toBeNull();
    });
});

describe('moveItem', () => {
    const items = ['a', 'b', 'c', 'd'];

    it('뒤로 옮긴다', () => {
        expect(moveItem(items, 0, 2)).toEqual(['b', 'c', 'a', 'd']);
    });

    it('앞으로 옮긴다', () => {
        expect(moveItem(items, 2, 0)).toEqual(['c', 'a', 'b', 'd']);
    });

    it('제자리나 범위 밖이면 그대로다', () => {
        expect(moveItem(items, 1, 1)).toEqual(items);
        expect(moveItem(items, -1, 2)).toEqual(items);
        expect(moveItem(items, 1, 9)).toEqual(items);
    });
});

describe('sameOrder', () => {
    it('id가 같은 차례면 같은 순서다', () => {
        expect(sameOrder([{ id: 'a' }, { id: 'b' }], [{ id: 'a' }, { id: 'b' }])).toBe(true);
        expect(sameOrder([{ id: 'a' }, { id: 'b' }], [{ id: 'b' }, { id: 'a' }])).toBe(false);
        expect(sameOrder([{ id: 'a' }], [{ id: 'a' }, { id: 'b' }])).toBe(false);
    });
});
