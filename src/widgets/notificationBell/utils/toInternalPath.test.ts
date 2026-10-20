import { describe, expect, it } from 'vitest';

import { toInternalPath } from './toInternalPath';

describe('toInternalPath', () => {
    it('내부 경로는 그대로 돌려준다', () => {
        expect(toInternalPath('/events/evt-001')).toBe('/events/evt-001');
    });

    it('역슬래시와 제어 문자가 포함된 경로는 null이다', () => {
        expect(toInternalPath('/\\evil.com')).toBeNull();
        expect(toInternalPath('/\t/evil.com')).toBeNull();
    });

    it('null·외부 URL·프로토콜 상대 URL은 null이다', () => {
        expect(toInternalPath(null)).toBeNull();
        expect(toInternalPath('https://example.com')).toBeNull();
        expect(toInternalPath('//example.com/x')).toBeNull();
    });
});
