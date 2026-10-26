import { describe, expect, it } from 'vitest';

import { maskName } from './format';

describe('maskName', () => {
    it('세 글자 이름은 가운데 한 글자를 가린다', () => {
        expect(maskName('김도윤')).toBe('김*윤');
    });

    it('네 글자 이상은 첫·끝 글자만 남긴다', () => {
        expect(maskName('남궁민수')).toBe('남**수');
    });

    it('두 글자는 뒤 글자를 가리고, 한 글자는 그대로 둔다', () => {
        expect(maskName('이솔')).toBe('이*');
        expect(maskName('김')).toBe('김');
    });
});
