import { describe, expect, it } from 'vitest';

import type { AdminEvent } from '@entities/event';

import { eventFormSchema, eventFormToRequest, eventToFormValues } from './eventFormValues';

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

describe('eventToFormValues', () => {
    const adminEvent = (prizeImages: AdminEvent['prizeImages']): AdminEvent =>
        ({
            title: '수정할 이벤트',
            description: '설명',
            imageUrl: 'https://cdn.example.com/images/events/hero.png',
            imageKey: 'events/hero.png',
            eventType: 'TICKET',
            weightingEnabled: true,
            maxTicketsPerUser: 5,
            membershipRule: 'excellent',
            startsAt: '2026-10-20T01:00:00Z',
            endsAt: '2026-10-21T01:00:00Z',
            prizes: [
                {
                    id: 'prize-1',
                    rank: 1,
                    name: '1등',
                    description: null,
                    imageUrl: 'https://cdn.example.com/images/prizes/one.png',
                    winnerCount: 1,
                },
                {
                    id: 'prize-2',
                    rank: 2,
                    name: '2등',
                    description: null,
                    imageUrl: null,
                    winnerCount: 2,
                },
            ],
            prizeImages,
        }) as AdminEvent;

    it('prizeImages의 키를 경품별 폼 값으로 되살린다', () => {
        const values = eventToFormValues(
            adminEvent([{ prizeId: 'prize-1', imageKey: 'prizes/one.png' }]),
        );

        expect(values.prizes[0]!.imageKey).toBe('prizes/one.png');
        // 키가 없는 경품은 빈 값 — 지운 것과 같게 다룬다
        expect(values.prizes[1]!.imageKey).toBe('');
    });

    /*
     * 제목만 고쳐 저장해도 경품 이미지 연결이 지워지던 버그를 막는다.
     * 키를 되살리지 않으면 imageKey가 null로 나가 서버가 연결을 끊는다.
     */
    it('이미지를 건드리지 않은 경품은 받은 키를 그대로 돌려보낸다', () => {
        const values = eventToFormValues(
            adminEvent([{ prizeId: 'prize-1', imageKey: 'prizes/one.png' }]),
        );
        const body = eventFormToRequest(eventFormSchema.parse({ ...values, title: '제목만 고침' }));

        expect(body.prizes[0]!.imageKey).toBe('prizes/one.png');
        expect(body.imageKey).toBe('events/hero.png');
    });

    it('사용자가 지운 경품만 null로 나간다', () => {
        const values = eventToFormValues(
            adminEvent([{ prizeId: 'prize-1', imageKey: 'prizes/one.png' }]),
        );
        values.prizes[0]!.imageKey = '';

        const body = eventFormToRequest(eventFormSchema.parse(values));

        expect(body.prizes[0]!.imageKey).toBeNull();
    });
});
