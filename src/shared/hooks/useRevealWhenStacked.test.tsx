import { render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { useRevealWhenStacked } from './useRevealWhenStacked';

function Panel({ id }: { id: string | null }) {
    const ref = useRevealWhenStacked<HTMLDivElement>(id, '(min-width: 1024px)');
    return <div ref={ref}>상세</div>;
}

function mockWidth(wide: boolean) {
    vi.stubGlobal('matchMedia', (query: string) => ({
        matches: query.includes('min-width') ? wide : false,
    }));
}

describe('useRevealWhenStacked', () => {
    afterEach(() => vi.unstubAllGlobals());

    it('칸이 쌓이는 좁은 폭에서는 새로 연 상세로 스크롤한다', () => {
        mockWidth(false);
        const scroll = vi.fn();
        Element.prototype.scrollIntoView = scroll;
        const { rerender } = render(<Panel id="a" />);
        rerender(<Panel id="b" />);
        expect(scroll).toHaveBeenCalledTimes(2);
    });

    it('두 칸이 나란한 넓은 폭에서는 스크롤하지 않는다', () => {
        mockWidth(true);
        const scroll = vi.fn();
        Element.prototype.scrollIntoView = scroll;
        render(<Panel id="a" />);
        expect(scroll).not.toHaveBeenCalled();
    });
});
