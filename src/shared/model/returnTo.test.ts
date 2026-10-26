import { describe, expect, it } from 'vitest';

import { readReturnTo } from './returnTo';

describe('readReturnTo', () => {
    it('링크 state에 실린 돌아갈 곳을 읽는다', () => {
        expect(
            readReturnTo({
                returnTo: { to: '/admin/events/e-1?status=OPEN', label: '이벤트 관리' },
            }),
        ).toEqual({ to: '/admin/events/e-1?status=OPEN', label: '이벤트 관리' });
    });

    it('메뉴로 들어와 state가 없거나 모양이 다르면 null', () => {
        expect(readReturnTo(null)).toBeNull();
        expect(readReturnTo({ other: 1 })).toBeNull();
        expect(readReturnTo({ returnTo: { to: 1, label: 'x' } })).toBeNull();
    });
});
