/**
 * 사진 한 장을 다른 색으로 보이게 하는 CSS filter 문자열을 만든다.
 *
 * 색상별로 사진을 따로 받는 게 가장 정확하지만, 한 색만 찍혀 있을 때도 나머지 색을 보여 주려면
 * 그 한 장을 틀어서 쓸 수밖에 없다. 기준 색(사진에 실제로 찍힌 색)과 목표 색의 HSL 차이를
 * hue-rotate·saturate·brightness로 옮긴다.
 *
 * 근사일 뿐이다. 밝기를 그대로 적용하면 사진에서 색을 입히려는 부분만이 아니라 금속 몸체·화면까지
 * 같이 어두워지거나 날아가므로 좁은 범위로 가둔다. 그래서 아주 어두운 색·아주 밝은 색은 끝까지
 * 가지 않는다. 사진 배경이 투명해야 쓸 수 있다 — 흰 배경이면 밝기를 내릴 때 배경이 회색이 된다.
 *
 * 색마다 실사 사진이 생기면 이 함수는 더 쓰지 않는다 (DetailVisual colors[].photoUrl).
 */
const BRIGHTNESS_RANGE = { min: 0.45, max: 1.4 } as const;
const MAX_SATURATE = 4;

interface Hsl {
    /** 0~360 */
    h: number;
    /** 0~1 */
    s: number;
    /** 0~1 */
    l: number;
}

/** #RRGGBB를 HSL로 — 형식이 아니면 null이다 */
export function hexToHsl(hex: string): Hsl | null {
    if (!/^#[0-9a-fA-F]{6}$/.test(hex)) return null;

    const r = parseInt(hex.slice(1, 3), 16) / 255;
    const g = parseInt(hex.slice(3, 5), 16) / 255;
    const b = parseInt(hex.slice(5, 7), 16) / 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const l = (max + min) / 2;

    if (max === min) return { h: 0, s: 0, l };

    const d = max - min;
    const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    const h =
        max === r
            ? ((g - b) / d + (g < b ? 6 : 0)) * 60
            : max === g
              ? ((b - r) / d + 2) * 60
              : ((r - g) / d + 4) * 60;

    return { h, s, l };
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/**
 * from 색으로 찍힌 사진을 to 색으로 보이게 하는 filter 값.
 * 두 색이 같거나 형식이 틀리면 undefined다 — 쓰는 쪽이 필터를 걸지 않는다.
 */
export function tintFilter(fromHex: string, toHex: string): string | undefined {
    if (fromHex.toLowerCase() === toHex.toLowerCase()) return undefined;

    const from = hexToHsl(fromHex);
    const to = hexToHsl(toHex);
    if (!from || !to) return undefined;

    // 색상환은 한 바퀴라 270도 돌리기보다 -90도 돌리는 쪽이 짧다
    let hue = (to.h - from.h) % 360;
    if (hue > 180) hue -= 360;
    if (hue < -180) hue += 360;

    // 무채색 사진은 채도를 곱해도 색이 생기지 않는다 — 비율을 1로 두고 밝기만 맞춘다
    const saturate = from.s === 0 ? 1 : clamp(to.s / from.s, 0, MAX_SATURATE);
    const brightness =
        from.l === 0 ? 1 : clamp(to.l / from.l, BRIGHTNESS_RANGE.min, BRIGHTNESS_RANGE.max);

    return [
        Math.round(hue) !== 0 ? `hue-rotate(${Math.round(hue)}deg)` : null,
        `saturate(${saturate.toFixed(2)})`,
        `brightness(${brightness.toFixed(2)})`,
    ]
        .filter(Boolean)
        .join(' ');
}
