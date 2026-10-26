/**
 * 타꼬 주문 규칙 — 손님 주문(타코야끼 순서)을 잠깐 보여 주고, 가린 뒤 같은 순서로 내준다 (순서 기억 게임).
 * 목숨 3개, 틀리면 하나 줄고 같은 길이의 새 주문을 받는다. 맞히면 주문이 하나씩 길어진다.
 * 시간 제한이 없어 손이 느려도 할 수 있다 — 다른 게임(반응·타이밍·순간 판단)과 쓰는 능력이 다르다
 */

/** 메뉴 — 토핑 색이 확실히 다른 네 가지 (피그마 image 237: 파 초록 · 치즈 노랑 · 새우 주황 · 김 검정) */
export const TAKKO_ORDER_MENU = [
    { id: 'scallion', name: '파' },
    { id: 'cheese', name: '치즈' },
    { id: 'shrimp', name: '새우' },
    { id: 'nori', name: '김' },
] as const;

export type TakkoOrderItemId = (typeof TAKKO_ORDER_MENU)[number]['id'];

export const TAKKO_ORDER_LIVES = 3;
/** 하루 보상 기준 점수 — 시작 응답 rules에 없어 계약값(getddo-spec game-takko-order 18점)을 둔다 */
export const TAKKO_ORDER_MIN_REWARD_SCORE = 18;
/** 첫 주문 길이 — 맞힐 때마다 하나씩 늘고 최대 길이에서 멈춘다 */
export const TAKKO_ORDER_START_LENGTH = 3;
export const TAKKO_ORDER_MAX_LENGTH = 8;

/** 다음 주문 길이 — 맞혔으면 하나 늘리고, 틀렸으면 그대로 */
export function nextTakkoOrderLength(length: number, ok: boolean): number {
    return ok ? Math.min(TAKKO_ORDER_MAX_LENGTH, length + 1) : length;
}

/** 맞힌 주문 점수 — 주문 길이만큼 (긴 주문일수록 많이) */
export const takkoOrderPoints = (length: number) => length;

/** 이 개수를 넘는 주문부터는 한 개당 보여 주는 시간을 더 준다 */
const LONG_ORDER_FROM = 4;

/**
 * 주문을 보여 주는 시간(ms) — 한 개당 0.6초 + 훑어볼 여유 0.8초.
 * 다섯 개부터는 한 번에 외우기 어렵다는 의견에 따라 넘는 개수마다 0.4초를 더 준다 (5개 4.2초 · 8개 7.2초).
 * 서버는 보여 준 시간을 검증하지 않는다 — 화면 연출 값이다
 */
export function takkoOrderShowMs(length: number): number {
    return 800 + length * 600 + Math.max(0, length - LONG_ORDER_FROM) * 400;
}

/**
 * 주문을 만든다. 같은 메뉴가 세 번 연달아 나오지 않게 한다 (너무 쉽거나 단조로워진다).
 * random은 0 이상 1 미만을 돌려주는 함수(테스트에서 고정값을 넣는다)
 */
export function createTakkoOrder(length: number, random: () => number): TakkoOrderItemId[] {
    const order: TakkoOrderItemId[] = [];
    while (order.length < length) {
        const id = TAKKO_ORDER_MENU[Math.floor(random() * TAKKO_ORDER_MENU.length)]!.id;
        const [a, b] = order.slice(-2);
        if (a === id && b === id) continue;
        order.push(id);
    }
    return order;
}

/**
 * 주문 개수만큼 다 낸 뒤의 판정 — 화면에서는 틀려도 끝까지 내게 하지만,
 * 서버 기록(picks)은 규칙대로 맞히면 주문 전체, 틀리면 처음 틀린 메뉴까지만 남긴다 (getddo-spec game-takko-order)
 */
export function judgeTakkoOrder(
    order: readonly TakkoOrderItemId[],
    picked: readonly TakkoOrderItemId[],
): { ok: boolean; record: TakkoOrderItemId[] } {
    const wrongAt = picked.findIndex((id, index) => id !== order[index]);
    return wrongAt === -1
        ? { ok: true, record: [...picked] }
        : { ok: false, record: picked.slice(0, wrongAt + 1) };
}

const ORDINAL_WORDS = ['첫', '두', '세', '네', '다섯', '여섯', '일곱', '여덟', '아홉', '열'];

/** 손님 순서 — "첫 번째 손님"처럼 열 번째까지는 말로, 그 뒤는 숫자로 적는다 */
export function takkoOrderCustomerLabel(n: number): string {
    const word = ORDINAL_WORDS[n - 1];
    return word ? `${word} 번째 손님` : `${n}번째 손님`;
}
