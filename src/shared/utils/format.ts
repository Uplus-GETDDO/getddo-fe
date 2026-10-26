export function formatNumber(value: number): string {
    return value.toLocaleString('ko-KR');
}

/**
 * 이름 가운데를 가린다 — 당첨 발표처럼 남에게 보일 수 있는 화면에서 쓴다.
 * 두 글자는 뒤 글자를, 세 글자 이상은 첫·끝 글자만 남긴다 (김도윤 → 김*윤, 남궁민수 → 남**수)
 */
export function maskName(name: string): string {
    const chars = [...name.trim()];
    if (chars.length <= 1) return chars.join('');
    if (chars.length === 2) return `${chars[0]}*`;
    return `${chars[0]}${'*'.repeat(chars.length - 2)}${chars.at(-1)}`;
}
