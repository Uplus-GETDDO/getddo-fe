import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { AdminEvent } from '@entities/event';

import { DrawEventPicker } from './DrawEventPicker';

const event = (overrides: Partial<AdminEvent>): AdminEvent => ({
    id: 'evt-1',
    title: '스위치 래플',
    description: '',
    imageUrl: null,
    imageKey: null,
    eventType: 'TICKET',
    weightingEnabled: true,
    maxTicketsPerUser: 5,
    membershipRule: 'excellent',
    startsAt: '2026-10-20T04:00:00Z',
    endsAt: '2026-10-20T05:00:00Z',
    status: 'DRAW_CONFIRMED',
    drawScheduledAt: '2026-10-20T05:05:00Z',
    serverTime: '2026-10-20T06:00:00Z',
    prizeImages: [],
    prizes: [
        {
            id: 'p1',
            rank: 1,
            name: '스위치',
            winnerCount: 2,
            description: null,
            imageUrl: null,
        },
    ],
    createdAt: '2026-10-19T01:00:00Z',
    updatedAt: '2026-10-19T01:00:00Z',
    canceledAt: null,
    ...overrides,
});

describe('추첨 관리 이벤트 표', () => {
    it('이벤트를 표의 줄로 보여 주고 유형을 겟또타임·이벤트로 나눈다', () => {
        render(
            <DrawEventPicker
                events={[
                    event({}),
                    event({ id: 'evt-2', title: '설문 이벤트', eventType: 'NO_TICKET' }),
                ]}
                onSelect={() => {}}
            />,
        );
        const rows = screen.getAllByRole('row').slice(1);
        expect(rows).toHaveLength(2);
        expect(within(rows[0]!).getByText('겟또타임')).toBeInTheDocument();
        expect(within(rows[0]!).getByText('2명')).toBeInTheDocument();
        expect(within(rows[1]!).getByText('이벤트')).toBeInTheDocument();
    });

    it('줄이나 관리 버튼을 누르면 그 이벤트를 연다', () => {
        const onSelect = vi.fn();
        render(<DrawEventPicker events={[event({})]} onSelect={onSelect} />);
        fireEvent.click(screen.getByRole('button', { name: '스위치 래플 추첨 관리' }));
        expect(onSelect).toHaveBeenCalledExactlyOnceWith('evt-1');
        fireEvent.click(screen.getByText('스위치 래플'));
        expect(onSelect).toHaveBeenCalledTimes(2);
    });
});
