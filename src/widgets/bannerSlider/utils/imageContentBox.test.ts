import { describe, expect, it } from 'vitest';

import { centerContentTransform } from './imageContentBox';

describe('상품 그림 가운데 맞춤', () => {
    it('이미 가운데에 꽉 찬 그림은 옮기지 않는다', () => {
        expect(centerContentTransform({ left: 0, top: 0, right: 1, bottom: 1 }, 100, 100)).toBe(
            'scale(1) translate(0%, 0%)',
        );
    });

    it('아래로 쏠린 그림은 위로 올리고 여백만큼 키운다', () => {
        // 정사각형 그림의 아래 절반에만 내용이 있다 — 가운데가 0.25 아래, 크기는 절반
        expect(
            centerContentTransform({ left: 0.25, top: 0.5, right: 0.75, bottom: 1 }, 100, 100),
        ).toBe('scale(1.6) translate(0%, -25%)');
    });
});
