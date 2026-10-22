import {
    TAKKO_ORDER_MAX_LENGTH,
    createTakkoOrder,
    judgeTakkoOrder,
    nextTakkoOrderLength,
    takkoOrderCustomerLabel,
    takkoOrderShowMs,
} from './takkoOrder';

describe('타꼬 주문 규칙', () => {
    it('주문은 정한 길이만큼 만들고 같은 메뉴가 세 번 연달아 나오지 않는다', () => {
        // 항상 0을 돌려주면 '파'만 나오려 하지만, 세 번째는 다른 메뉴로 바뀌어야 한다
        let call = 0;
        const random = () => (call++ % 3 === 2 ? 0.5 : 0);
        const order = createTakkoOrder(6, random);
        expect(order).toHaveLength(6);
        for (let i = 2; i < order.length; i += 1) {
            expect(order[i] === order[i - 1] && order[i] === order[i - 2]).toBe(false);
        }
    });

    it('다 낸 주문을 판정하고, 틀리면 처음 틀린 메뉴까지만 기록한다', () => {
        const order = ['scallion', 'cheese', 'shrimp'] as const;
        expect(judgeTakkoOrder(order, ['scallion', 'cheese', 'shrimp'])).toEqual({
            ok: true,
            record: ['scallion', 'cheese', 'shrimp'],
        });
        expect(judgeTakkoOrder(order, ['scallion', 'nori', 'nori'])).toEqual({
            ok: false,
            record: ['scallion', 'nori'],
        });
        expect(judgeTakkoOrder(order, ['cheese', 'cheese', 'shrimp'])).toEqual({
            ok: false,
            record: ['cheese'],
        });
    });

    it('맞히면 주문이 하나 길어지고 최대 길이에서 멈춘다, 틀리면 그대로', () => {
        expect(nextTakkoOrderLength(3, true)).toBe(4);
        expect(nextTakkoOrderLength(3, false)).toBe(3);
        expect(nextTakkoOrderLength(TAKKO_ORDER_MAX_LENGTH, true)).toBe(TAKKO_ORDER_MAX_LENGTH);
    });

    it('보여 주는 시간은 주문이 길수록 늘어난다', () => {
        expect(takkoOrderShowMs(4)).toBeGreaterThan(takkoOrderShowMs(3));
        // 네 개까지는 한 개당 0.6초, 다섯 개부터는 넘는 개수마다 0.4초를 더 준다
        expect(takkoOrderShowMs(4)).toBe(3200);
        expect(takkoOrderShowMs(5)).toBe(4200);
        expect(takkoOrderShowMs(8)).toBe(7200);
    });
});

describe('손님 순서 표기', () => {
    it('열 번째까지는 말로, 그 뒤는 숫자로 적는다', () => {
        expect(takkoOrderCustomerLabel(1)).toBe('첫 번째 손님');
        expect(takkoOrderCustomerLabel(2)).toBe('두 번째 손님');
        expect(takkoOrderCustomerLabel(10)).toBe('열 번째 손님');
        expect(takkoOrderCustomerLabel(11)).toBe('11번째 손님');
    });
});
