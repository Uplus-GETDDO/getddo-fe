import { pageItems } from './pagination';

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
