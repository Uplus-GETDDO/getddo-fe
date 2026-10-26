import { orderEarnCards } from './orderEarnCards';

const card = (
    id: string,
    category: 'ATTENDANCE' | 'MISSION' | 'GAME',
    rewardTickets = 1,
    completed = false,
) => ({ id, category, rewardTickets, completed });

const ids = (cards: { id: string }[]) => cards.map((c) => c.id);

describe('orderEarnCards', () => {
    it('출석을 앞에 두고 미션·게임을 번갈아 둔다', () => {
        const cards = [
            card('att', 'ATTENDANCE'),
            card('m1', 'MISSION'),
            card('m2', 'MISSION'),
            card('m3', 'MISSION'),
            card('g1', 'GAME'),
            card('g2', 'GAME'),
        ];
        expect(ids(orderEarnCards(cards))).toEqual(['att', 'm1', 'g1', 'm2', 'g2', 'm3']);
    });

    it('같은 종류 안에서는 응모권이 많은 순, 같으면 원래 순서', () => {
        const cards = [
            card('m1', 'MISSION', 1),
            card('m2', 'MISSION', 2),
            card('m3', 'MISSION', 1),
        ];
        expect(ids(orderEarnCards(cards))).toEqual(['m2', 'm1', 'm3']);
    });

    it('오늘 다 한 카드는 출석이어도 맨 뒤로 보낸다', () => {
        const cards = [
            card('att', 'ATTENDANCE', 1, true),
            card('m1', 'MISSION', 1, true),
            card('m2', 'MISSION'),
            card('g1', 'GAME'),
        ];
        expect(ids(orderEarnCards(cards))).toEqual(['m2', 'g1', 'att', 'm1']);
    });
});
