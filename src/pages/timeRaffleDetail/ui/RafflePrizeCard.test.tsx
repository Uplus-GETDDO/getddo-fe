import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { Event, EventPrize } from '@entities/event';

import { RafflePrizeCard } from './RafflePrizeCard';

const BASE: Event = {
    id: 'evt-1',
    title: '무너 굿즈 겟또타임',
    description: '설명',
    bannerImageUrl: null,
    startsAt: '2026-10-26T00:00:00.000Z',
    endsAt: '2026-10-26T01:00:00.000Z',
    status: 'open',
    eventType: 'TICKET',
    weightingEnabled: false,
    myEntered: false,
    membershipRule: 'excellent',
    requiredTickets: 1,
};

const prize = (over: Partial<EventPrize> = {}): EventPrize => ({
    id: 'prize-1',
    rank: 1,
    name: '헤드셋',
    description: null,
    imageUrl: '/images/prizes/headset.png',
    winnerCount: 1,
    ...over,
});

describe('RafflePrizeCard', () => {
    /*
     * 관리자가 올린 경품 그림을 보이는 유일한 자리다 — 서버가 prizes를 내려주는데도
     * 화면 모델이 요약(이름·인원)만 남기고 버려서 그림이 아무 데도 나오지 않았다(GD-355).
     */
    it('경품 그림을 서버가 준 주소로 그린다', () => {
        const { container } = render(<RafflePrizeCard event={{ ...BASE, prizes: [prize()] }} />);

        // 이름이 바로 옆에 있어 그림은 alt를 비운 장식이다 — 역할로는 잡히지 않아 태그로 찾는다
        expect(container.querySelector('img')).toHaveAttribute('src', '/images/prizes/headset.png');
        expect(screen.getByText('헤드셋')).toBeInTheDocument();
        expect(screen.getByText('단 1명')).toBeInTheDocument();
    });

    it('경품이 여럿이면 등수와 종 수를 함께 보인다', () => {
        render(
            <RafflePrizeCard
                event={{
                    ...BASE,
                    prizes: [prize(), prize({ id: 'prize-2', rank: 2, name: '텀블러' })],
                }}
            />,
        );

        expect(screen.getByText('2종')).toBeInTheDocument();
        expect(screen.getByText('1등')).toBeInTheDocument();
        expect(screen.getByText('2등')).toBeInTheDocument();
    });

    // 상세가 오기 전이거나 경품이 없는 이벤트에서 빈 카드가 남으면 화면만 들썩인다
    it('경품이 없으면 카드를 그리지 않는다', () => {
        const { container } = render(<RafflePrizeCard event={BASE} />);

        expect(container).toBeEmptyDOMElement();
    });

    it('그림이 없는 경품도 줄은 그대로 보인다', () => {
        const { container } = render(
            <RafflePrizeCard event={{ ...BASE, prizes: [prize({ imageUrl: null })] }} />,
        );

        // 빈 칸에는 ImagePlaceholder의 마스코트가 들어간다 — 경품 주소를 쓴 그림은 없어야 한다
        const sources = [...container.querySelectorAll('img')].map((img) =>
            img.getAttribute('src'),
        );
        expect(sources.some((src) => src?.includes('/images/prizes/'))).toBe(false);
        expect(screen.getByText('헤드셋')).toBeInTheDocument();
    });
});
