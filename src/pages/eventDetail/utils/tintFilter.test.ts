import { hexToHsl, tintFilter } from './tintFilter';

describe('hexToHsl', () => {
    it('무채색은 채도가 0이다', () => {
        expect(hexToHsl('#808080')).toMatchObject({ h: 0, s: 0 });
    });

    it('사진 기준 라벤더를 읽는다', () => {
        const hsl = hexToHsl('#AFA6BD');
        expect(Math.round(hsl!.h)).toBe(263);
        expect(hsl!.s).toBeCloseTo(0.14, 1);
        expect(hsl!.l).toBeCloseTo(0.7, 1);
    });

    it('#RRGGBB가 아니면 null이다', () => {
        expect(hexToHsl('#fff')).toBeNull();
        expect(hexToHsl('red')).toBeNull();
    });
});

describe('tintFilter', () => {
    it('같은 색이면 필터를 걸지 않는다', () => {
        expect(tintFilter('#AFA6BD', '#afa6bd')).toBeUndefined();
    });

    it('형식이 틀리면 필터를 걸지 않는다', () => {
        expect(tintFilter('#AFA6BD', 'lavender')).toBeUndefined();
    });

    it('색상환을 짧은 쪽으로 돌린다', () => {
        // 라벤더(263도) → 핑크(345도)는 +82도지만, 그린(144도)은 +241이 아니라 -120이다
        expect(tintFilter('#AFA6BD', '#E9A3B4')).toContain('hue-rotate(82deg)');
        expect(tintFilter('#AFA6BD', '#7FA58E')).toContain('hue-rotate(-120deg)');
    });

    it('밝기를 좁은 범위로 가둔다 — 금속 몸체까지 어두워지지 않게', () => {
        // 그라파이트는 기준보다 한참 어두워 비율대로면 0.36이지만 하한에서 멈춘다
        expect(tintFilter('#AFA6BD', '#3B3F45')).toContain('brightness(0.45)');
    });

    it('채도를 올려 색을 입힌다', () => {
        // 기준 채도가 낮아(14%) 핑크(63%)로 가려면 크게 올려야 한다
        const filter = tintFilter('#AFA6BD', '#E9A3B4');
        const saturate = Number(/saturate\(([\d.]+)\)/.exec(filter!)?.[1]);
        expect(saturate).toBeGreaterThan(2);
        expect(saturate).toBeLessThanOrEqual(4);
    });

    it('무채색 사진이면 채도를 건드리지 않는다', () => {
        expect(tintFilter('#808080', '#4A6FA5')).toContain('saturate(1.00)');
    });
});
