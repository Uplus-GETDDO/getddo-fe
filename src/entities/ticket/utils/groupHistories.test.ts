import type { TicketHistory } from '../model/history';

import { groupTicketHistories } from './groupHistories';

const history = (overrides: Partial<TicketHistory>): TicketHistory => ({
    id: crypto.randomUUID(),
    ticketId: crypto.randomUUID(),
    operationType: 'GRANT',
    grade: 'BRONZE',
    status: 'AVAILABLE',
    expiresAt: '2026-10-31T15:00:00Z',
    reason: '매일 출석체크 리워드',
    createdAt: '2026-10-13T00:00:00Z',
    ...overrides,
});

describe('groupTicketHistories', () => {
    it('같은 응모(eventEntryId)에 쓴 여러 장을 한 줄로 묶고 등급별 장수를 센다', () => {
        const use = { operationType: 'USE' as const, reason: '래플 응모', eventEntryId: 'entry-1' };
        const groups = groupTicketHistories([
            history({ ...use, grade: 'GOLD' }),
            history({ ...use, grade: 'SILVER' }),
            history({ ...use, grade: 'SILVER', createdAt: '2026-10-13T00:00:01Z' }),
        ]);

        expect(groups).toHaveLength(1);
        expect(groups[0]).toMatchObject({
            count: 3,
            delta: -3,
            countByGrade: { BRONZE: 0, SILVER: 2, GOLD: 1, PLATINUM: 0 },
            detail: '응모에 사용',
            createdAt: '2026-10-13T00:00:01Z',
        });
    });

    it('응모 번호가 없으면 처리 종류·사유·분이 같은 것만 묶고 최신순으로 돌려준다', () => {
        const groups = groupTicketHistories([
            history({ attendanceDate: '2026-10-12', createdAt: '2026-10-12T00:00:00Z' }),
            history({ gameId: 'game-1', reason: '게임 보상', grade: 'SILVER' }),
            history({
                operationType: 'EXPIRE',
                reason: '응모권 월 만료',
                createdAt: '2026-10-01T00:00:00Z',
            }),
            history({
                operationType: 'EXPIRE',
                reason: '응모권 월 만료',
                createdAt: '2026-10-01T00:00:00Z',
            }),
        ]);

        expect(groups.map((group) => [group.detail, group.delta])).toEqual([
            ['게임 보상', 1],
            ['출석 보상', 1],
            ['기한이 지나 만료', -2],
        ]);
    });

    it('정정은 장수를 바꾸지 않아 변동이 없다', () => {
        const [group] = groupTicketHistories([
            history({ operationType: 'CORRECTION', reason: '정정' }),
        ]);
        expect(group?.delta).toBeNull();
    });
});
