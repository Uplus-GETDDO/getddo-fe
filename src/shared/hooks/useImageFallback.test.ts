import { act, renderHook } from '@testing-library/react';

import { useImageFallback } from './useImageFallback';

describe('useImageFallback', () => {
    it('주소가 있으면 그린다', () => {
        const { result } = renderHook(() => useImageFallback('/a.png'));
        expect(result.current.shown).toBe(true);
    });

    it('주소가 없으면 그리지 않는다', () => {
        expect(renderHook(() => useImageFallback(null)).result.current.shown).toBe(false);
        expect(renderHook(() => useImageFallback(undefined)).result.current.shown).toBe(false);
    });

    it('깨지면 대체 칸으로 떨어진다', () => {
        const { result } = renderHook(() => useImageFallback('/broken.png'));
        act(() => result.current.onError());
        expect(result.current.shown).toBe(false);
    });

    it('주소가 바뀌면 다시 시도한다', () => {
        const { result, rerender } = renderHook(({ src }) => useImageFallback(src), {
            initialProps: { src: '/broken.png' },
        });
        act(() => result.current.onError());
        expect(result.current.shown).toBe(false);
        rerender({ src: '/next.png' });
        expect(result.current.shown).toBe(true);
    });
});
