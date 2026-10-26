import { eventDetailPath } from './eventPath';

describe('eventDetailPath', () => {
    it('겟또타임은 겟또타임 상세로 간다', () => {
        expect(eventDetailPath({ id: 'evt-1', isTimeRaffle: true })).toBe('/time-raffle/evt-1');
    });
    it('그 밖의 이벤트는 이벤트 상세로 간다', () => {
        expect(eventDetailPath({ id: 'evt-2', isTimeRaffle: false })).toBe('/events/evt-2');
    });
});
