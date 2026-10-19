import type { Event } from '@entities/event';

import { filterEvents, readEventSort, readEventTab } from './filterEvents';

const event = (overrides: Partial<Event>): Event =>
    ({
        id: 'evt',
        title: '테스트',
        status: 'open',
        startsAt: '2026-10-01T00:00:00Z',
        endsAt: '2026-10-31T00:00:00Z',
        winnerCount: 10,
        tags: [],
        ...overrides,
    }) as Event;

describe('readEventTab', () => {
    it('아는 값은 그대로 읽는다', () => {
        expect(readEventTab('past')).toBe('past');
    });

    it('모르는 값·없는 값은 진행 중으로 돌린다', () => {
        expect(readEventTab('drawn')).toBe('open');
        expect(readEventTab(null)).toBe('open');
    });
});

describe('readEventSort', () => {
    it('모르는 값은 최신순으로 돌린다', () => {
        expect(readEventSort('closing')).toBe('closing');
        expect(readEventSort('인기순')).toBe('latest');
    });
});

describe('filterEvents', () => {
    const events = [
        event({ id: 'open', status: 'open' }),
        event({ id: 'upcoming', status: 'upcoming' }),
        event({ id: 'closed', status: 'closed' }),
        event({ id: 'drawn', status: 'drawn' }),
        event({ id: 'raffle', status: 'open', isTimeRaffle: true }),
    ];

    it('지난 이벤트 탭은 마감과 발표 완료를 함께 담는다', () => {
        expect(filterEvents(events, 'past', '전체', 'latest').map((e) => e.id)).toEqual([
            'closed',
            'drawn',
        ]);
    });

    it('탭마다 해당 상태만 남긴다', () => {
        expect(filterEvents(events, 'open', '전체', 'latest').map((e) => e.id)).toEqual(['open']);
        expect(filterEvents(events, 'upcoming', '전체', 'latest').map((e) => e.id)).toEqual([
            'upcoming',
        ]);
    });

    it('타임래플은 어느 탭에도 넣지 않는다 — 전용 화면이 따로 있다', () => {
        const ids = filterEvents(events, 'open', '전체', 'latest').map((e) => e.id);
        expect(ids).not.toContain('raffle');
    });

    it('카테고리 칩으로 거른다', () => {
        const tagged = [
            event({ id: 'a', tags: ['한정 굿즈'] }),
            event({ id: 'b', tags: ['디지털기기'] }),
            event({ id: 'c' }),
        ];
        expect(filterEvents(tagged, 'open', '한정 굿즈', 'latest').map((e) => e.id)).toEqual(['a']);
        expect(filterEvents(tagged, 'open', '전체', 'latest')).toHaveLength(3);
    });

    it('최신순은 시작일 내림차순, 마감 임박순은 마감일 오름차순이다', () => {
        const byDate = [
            event({
                id: 'early',
                startsAt: '2026-10-01T00:00:00Z',
                endsAt: '2026-10-20T00:00:00Z',
            }),
            event({ id: 'late', startsAt: '2026-10-10T00:00:00Z', endsAt: '2026-10-30T00:00:00Z' }),
        ];
        expect(filterEvents(byDate, 'open', '전체', 'latest').map((e) => e.id)).toEqual([
            'late',
            'early',
        ]);
        expect(filterEvents(byDate, 'open', '전체', 'closing').map((e) => e.id)).toEqual([
            'early',
            'late',
        ]);
    });

    it('당첨 인원순은 많은 쪽이 먼저다', () => {
        const byWinners = [
            event({ id: 'few', winnerCount: 3 }),
            event({ id: 'many', winnerCount: 300 }),
        ];
        expect(filterEvents(byWinners, 'open', '전체', 'winners').map((e) => e.id)).toEqual([
            'many',
            'few',
        ]);
    });

    it('받은 배열을 제자리에서 정렬하지 않는다 — 쿼리 캐시가 들고 있는 배열이다', () => {
        const source = [
            event({ id: 'a', startsAt: '2026-10-01T00:00:00Z' }),
            event({ id: 'b', startsAt: '2026-10-10T00:00:00Z' }),
        ];
        filterEvents(source, 'open', '전체', 'latest');
        expect(source.map((e) => e.id)).toEqual(['a', 'b']);
    });
});
