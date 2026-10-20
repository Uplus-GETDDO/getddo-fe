import { describe, expect, it } from 'vitest';

import { moveBannerId } from './bannerOrder';

describe('moveBannerId', () => {
    const ids = ['a', 'b', 'c'];

    it('한 칸 위로 옮긴다', () => {
        expect(moveBannerId(ids, 'b', 'up')).toEqual(['b', 'a', 'c']);
    });

    it('한 칸 아래로 옮기고 원본을 바꾸지 않는다', () => {
        expect(moveBannerId(ids, 'b', 'down')).toEqual(['a', 'c', 'b']);
        expect(ids).toEqual(['a', 'b', 'c']);
    });

    it('맨 위·맨 아래·없는 ID는 null이다', () => {
        expect(moveBannerId(ids, 'a', 'up')).toBeNull();
        expect(moveBannerId(ids, 'c', 'down')).toBeNull();
        expect(moveBannerId(ids, 'x', 'up')).toBeNull();
    });
});
