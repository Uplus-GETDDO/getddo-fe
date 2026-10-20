import { describe, expect, it } from 'vitest';

import { eventFormSchema, eventFormToRequest } from './eventFormValues';

const base = {
    title: '테스트 이벤트',
    description: '설명',
    imageKey: '',
    membershipRule: 'excellent' as const,
    startsAt: '2026-10-20T10:00',
    endsAt: '2026-10-21T10:00',
    prizes: [{ rank: 1, name: '경품', winnerCount: 1, description: '', imageKey: '' }],
};

describe('eventFormToRequest', () => {
    it('NO_TICKET은 가중치와 상한을 해제한다', () => {
        const body = eventFormToRequest(
            eventFormSchema.parse({
                ...base,
                eventType: 'NO_TICKET',
                weightingEnabled: false,
                maxTicketsPerUser: '',
            }),
        );
        expect(body.weightingEnabled).toBe(false);
        expect(body.maxTicketsPerUser).toBeNull();
    });

    it('NO_TICKET에서 가중치가 켜져 있어도 false로 강제한다', () => {
        const body = eventFormToRequest(
            eventFormSchema.parse({
                ...base,
                eventType: 'NO_TICKET',
                weightingEnabled: true,
                maxTicketsPerUser: '5',
            }),
        );
        expect(body.weightingEnabled).toBe(false);
        expect(body.maxTicketsPerUser).toBeNull();
    });

    it('가중치 미적용 TICKET은 사용자당 1장을 보낸다', () => {
        const body = eventFormToRequest(
            eventFormSchema.parse({
                ...base,
                eventType: 'TICKET',
                weightingEnabled: false,
                maxTicketsPerUser: '',
            }),
        );
        expect(body.weightingEnabled).toBe(false);
        expect(body.maxTicketsPerUser).toBe(1);
    });

    it('가중치 적용 TICKET은 입력한 상한을 숫자로 보낸다', () => {
        const body = eventFormToRequest(
            eventFormSchema.parse({
                ...base,
                eventType: 'TICKET',
                weightingEnabled: true,
                maxTicketsPerUser: '5',
            }),
        );
        expect(body.weightingEnabled).toBe(true);
        expect(body.maxTicketsPerUser).toBe(5);
    });

    it('가중치 적용 + 빈 상한은 null(월말 소진용)로 보낸다', () => {
        const body = eventFormToRequest(
            eventFormSchema.parse({
                ...base,
                eventType: 'TICKET',
                weightingEnabled: true,
                maxTicketsPerUser: '',
            }),
        );
        expect(body.maxTicketsPerUser).toBeNull();
    });

    it('KST datetime-local 입력을 UTC ISO로 변환한다', () => {
        const body = eventFormToRequest(
            eventFormSchema.parse({
                ...base,
                eventType: 'NO_TICKET',
                weightingEnabled: false,
                maxTicketsPerUser: '',
            }),
        );
        expect(body.startsAt).toBe('2026-10-20T01:00:00.000Z');
        expect(body.endsAt).toBe('2026-10-21T01:00:00.000Z');
    });

    it('경품의 id를 그대로 넘겨 수정 시 기존 경품을 식별하게 한다', () => {
        const body = eventFormToRequest(
            eventFormSchema.parse({
                ...base,
                eventType: 'NO_TICKET',
                weightingEnabled: false,
                maxTicketsPerUser: '',
                prizes: [
                    {
                        id: 'prize-1',
                        rank: 1,
                        name: '경품',
                        winnerCount: 2,
                        description: '',
                        imageKey: '',
                    },
                ],
            }),
        );
        expect(body.prizes[0]?.id).toBe('prize-1');
    });
});

describe('eventFormSchema', () => {
    it('가중치 적용 상한에 0 이하·6 이상·비정수 문자열을 거절한다', () => {
        for (const bad of ['0', '-1', '6', '10', '1.5', 'abc']) {
            const result = eventFormSchema.safeParse({
                ...base,
                eventType: 'TICKET',
                weightingEnabled: true,
                maxTicketsPerUser: bad,
            });
            expect(result.success).toBe(false);
        }
    });

    it('같은 등수의 경품 중복을 거절한다', () => {
        const result = eventFormSchema.safeParse({
            ...base,
            eventType: 'NO_TICKET',
            weightingEnabled: false,
            maxTicketsPerUser: '',
            prizes: [
                { rank: 1, name: 'A', winnerCount: 1, description: '', imageKey: '' },
                { rank: 1, name: 'B', winnerCount: 1, description: '', imageKey: '' },
            ],
        });
        expect(result.success).toBe(false);
    });
});
