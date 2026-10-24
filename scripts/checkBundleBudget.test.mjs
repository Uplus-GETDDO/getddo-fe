import { describe, expect, it } from 'vitest';
import { evaluateBudget } from './checkBundleBudget.mjs';

const budget = {
    initialJsGzipBytes: 262144,
    initialCssGzipBytes: 30720,
};

describe('evaluateBudget', () => {
    it('두 지표 모두 버짓 이내면 ok', () => {
        const r = evaluateBudget({ initialJsGzip: 237816, initialCssGzip: 25178 }, budget);
        expect(r.ok).toBe(true);
        expect(r.violations).toEqual([]);
    });
    it('초기 JS 초과 시 해당 항목만 violation', () => {
        const r = evaluateBudget({ initialJsGzip: 262145, initialCssGzip: 25178 }, budget);
        expect(r.ok).toBe(false);
        expect(r.violations).toEqual([{ key: 'initialJsGzip', actual: 262145, limit: 262144 }]);
    });
    it('CSS 초과도 violation으로 보고', () => {
        const r = evaluateBudget({ initialJsGzip: 1, initialCssGzip: 30721 }, budget);
        expect(r.violations).toEqual([{ key: 'initialCssGzip', actual: 30721, limit: 30720 }]);
    });
});
