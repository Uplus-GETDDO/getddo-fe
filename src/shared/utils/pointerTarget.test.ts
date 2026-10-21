import { describe, expect, it } from 'vitest';

import { startsOnOwnControl } from './pointerTarget';

function build(html: string) {
    const host = document.createElement('div');
    host.innerHTML = html;
    return host;
}

describe('startsOnOwnControl', () => {
    it('버튼과 그 안의 글자·아이콘에서 시작한 누름은 버튼의 것이다', () => {
        const host = build('<button><span>삭제</span></button>');
        expect(startsOnOwnControl(host.querySelector('button'))).toBe(true);
        expect(startsOnOwnControl(host.querySelector('span'))).toBe(true);
    });

    it('링크·입력도 마찬가지다', () => {
        const host = build('<a href="#">상세</a><input /><select></select><textarea></textarea>');
        for (const selector of ['a', 'input', 'select', 'textarea']) {
            expect(startsOnOwnControl(host.querySelector(selector))).toBe(true);
        }
    });

    it('평범한 칸이나 대상이 없으면 끌기를 시작해도 된다', () => {
        const host = build('<td><span>출석왕 챌린지</span></td>');
        expect(startsOnOwnControl(host.querySelector('span'))).toBe(false);
        expect(startsOnOwnControl(null)).toBe(false);
    });
});
