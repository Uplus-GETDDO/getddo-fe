import { getTicketHistoryLink } from './historyLink';

describe('getTicketHistoryLink', () => {
    it('응모·반환에 연결된 래플이 있으면 그 래플 상세로 보낸다', () => {
        expect(getTicketHistoryLink({ operationType: 'USE', eventId: 'evt-1' })).toEqual({
            to: '/time-raffle/evt-1',
            label: '응모한 래플 보기',
        });
        expect(getTicketHistoryLink({ operationType: 'REFUND', eventId: 'evt-2' })?.to).toBe(
            '/time-raffle/evt-2',
        );
    });

    it('래플 id에 경로 구분 문자가 있어도 인코딩해 한 경로 조각으로 넣는다', () => {
        expect(getTicketHistoryLink({ operationType: 'USE', eventId: 'a/b?c#d' })?.to).toBe(
            '/time-raffle/a%2Fb%3Fc%23d',
        );
    });

    it('연결된 래플이 없으면 내 응모 내역으로 보낸다', () => {
        expect(getTicketHistoryLink({ operationType: 'USE', eventId: null })?.to).toBe(
            '/my-entries',
        );
        expect(getTicketHistoryLink({ operationType: 'USE' })?.to).toBe('/my-entries');
    });

    it('적립에는 링크가 없고, 만료·정정은 내 응모권으로 보낸다', () => {
        expect(getTicketHistoryLink({ operationType: 'GRANT', eventId: 'evt-1' })).toBeUndefined();
        expect(getTicketHistoryLink({ operationType: 'EXPIRE' })?.to).toBe('/my-tickets');
        expect(getTicketHistoryLink({ operationType: 'CORRECTION' })?.to).toBe('/my-tickets');
    });
});
