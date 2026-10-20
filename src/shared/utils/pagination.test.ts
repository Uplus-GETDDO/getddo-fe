import { pageItems, pageSlice } from './pagination';

describe('pageItems', () => {
    it('7쪽 이하는 번호를 모두 보인다', () => {
        expect(pageItems(1, 1)).toEqual([1]);
        expect(pageItems(3, 7)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    });

    it('앞쪽에 있으면 뒤만 접는다', () => {
        expect(pageItems(2, 10)).toEqual([1, 2, 3, 4, 5, 'ellipsis-end', 10]);
        expect(pageItems(4, 10)).toEqual([1, 2, 3, 4, 5, 'ellipsis-end', 10]);
    });

    it('가운데에 있으면 앞뒤를 접고 현재 앞뒤 한 칸을 둔다', () => {
        expect(pageItems(6, 10)).toEqual([1, 'ellipsis-start', 5, 6, 7, 'ellipsis-end', 10]);
    });

    it('뒤쪽에 있으면 앞만 접는다', () => {
        expect(pageItems(7, 10)).toEqual([1, 'ellipsis-start', 6, 7, 8, 9, 10]);
        expect(pageItems(10, 10)).toEqual([1, 'ellipsis-start', 6, 7, 8, 9, 10]);
    });
});

const list = Array.from({ length: 12 }, (_, index) => index + 1);

describe('pageSlice', () => {
    it('쪽 번호에 맞는 줄만 자른다', () => {
        expect(pageSlice(list, 2, 5)).toEqual({
            items: [6, 7, 8, 9, 10],
            current: 2,
            totalPages: 3,
        });
        expect(pageSlice(list, 3, 5).items).toEqual([11, 12]);
    });
    it('줄이 줄어 쪽이 사라지면 마지막 쪽을 보인다', () => {
        expect(pageSlice(list.slice(0, 4), 3, 5)).toEqual({
            items: [1, 2, 3, 4],
            current: 1,
            totalPages: 1,
        });
    });
    it('빈 목록도 1쪽으로 센다', () => {
        expect(pageSlice([], 1, 5)).toEqual({ items: [], current: 1, totalPages: 1 });
    });
});
