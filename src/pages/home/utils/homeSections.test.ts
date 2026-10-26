import type { Event } from '@entities/event';

import { myAwaitingResults } from './homeSections';

const event = (overrides: Partial<Event>): Event =>
    ({ id: 'evt', title: '테스트', status: 'closed', myEntered: true, ...overrides }) as Event;

describe('myAwaitingResults', () => {
    it('응모하지 않은 이벤트는 빼고 내 것만 남긴다', () => {
        const events = [
            event({ id: 'mine', myEntered: true }),
            event({ id: 'others', myEntered: false }),
        ];
        expect(myAwaitingResults(events).map((e) => e.id)).toEqual(['mine']);
    });

    it('마감과 발표 완료를 함께 담는다', () => {
        const events = [
            event({ id: 'closed', status: 'closed' }),
            event({ id: 'drawn', status: 'drawn' }),
        ];
        expect(myAwaitingResults(events).map((e) => e.id)).toEqual(['closed', 'drawn']);
    });

    it('아직 끝나지 않은 이벤트는 넣지 않는다 — 기다릴 결과가 없다', () => {
        const events = [
            event({ id: 'open', status: 'open' }),
            event({ id: 'upcoming', status: 'upcoming' }),
        ];
        expect(myAwaitingResults(events)).toEqual([]);
    });
});
