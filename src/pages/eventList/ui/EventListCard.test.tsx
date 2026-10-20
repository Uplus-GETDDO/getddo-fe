import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import type { Event } from '@entities/event';

import { VirtualClockProvider } from '@shared/model/virtualClock';

import { EventListCard } from './EventListCard';

const event = (overrides: Partial<Event>): Event =>
    ({
        id: 'evt-1',
        title: '데이터 쿠폰 응모',
        status: 'open',
        startsAt: '2026-10-01T00:00:00Z',
        endsAt: '2026-10-31T00:00:00Z',
        myEntered: false,
        tags: [],
        ...overrides,
    }) as Event;

const renderCard = (overrides: Partial<Event>) =>
    render(
        <VirtualClockProvider>
            <MemoryRouter>
                <EventListCard event={event(overrides)} />
            </MemoryRouter>
        </VirtualClockProvider>,
    );

describe('EventListCard', () => {
    it('내가 응모한 이벤트에만 응모 완료를 적는다', () => {
        renderCard({ myEntered: true });
        expect(screen.getByText('응모 완료')).toBeInTheDocument();
    });

    it('응모하지 않았으면 적지 않는다', () => {
        renderCard({ myEntered: false });
        expect(screen.queryByText('응모 완료')).not.toBeInTheDocument();
    });

    // 응모 완료는 '내 상태', 상태 칩은 '이벤트 상태'라 서로를 가리지 않고 함께 선다
    it('마감한 이벤트에도 내 응모 여부를 함께 적는다', () => {
        renderCard({ status: 'closed', myEntered: true });
        expect(screen.getByText('발표 대기')).toBeInTheDocument();
        expect(screen.getByText('응모 완료')).toBeInTheDocument();
    });
});
