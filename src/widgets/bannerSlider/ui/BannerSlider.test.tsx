import type { MockInstance } from 'vitest';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { apiClient } from '@shared/api/client';
import { VirtualClockProvider } from '@shared/model/virtualClock';

import { BannerSlider } from './BannerSlider';

const { motion } = vi.hoisted(() => ({ motion: { reduced: false } }));
vi.mock('framer-motion', () => ({ useReducedMotion: () => motion.reduced }));

const banners = [
    { id: 'banner-z', eventId: 'free', imageUrl: '/first.png', displayOrder: 2 },
    { id: 'banner-a', eventId: 'ticket', imageUrl: '/second.png', displayOrder: 8 },
];
const detail = (id: string) => ({
    id,
    title: id === 'free' ? '일반 이벤트' : '겟또타임 이벤트',
    description: '',
    imageUrl: null,
    eventType: id === 'free' ? 'NO_TICKET' : 'TICKET',
    weightingEnabled: false,
    membershipRule: 'excellent',
    startsAt: '2026-10-01T00:00:00Z',
    endsAt: '2026-11-01T00:00:00Z',
    status: 'OPEN',
    serverTime: '2026-10-20T00:00:00Z',
    maxTicketsPerUser: null,
    prizes: [],
});
const envelope = (data: unknown) => ({
    data: { success: true, code: 'SUCCESS', message: '', data },
});

function mount() {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
    const view = render(
        <QueryClientProvider client={client}>
            <VirtualClockProvider>
                <MemoryRouter>
                    <BannerSlider />
                </MemoryRouter>
            </VirtualClockProvider>
        </QueryClientProvider>,
    );
    return { ...view, client };
}

let get: MockInstance<typeof apiClient.get>;
beforeEach(() => {
    motion.reduced = false;
    get = vi.spyOn(apiClient, 'get');
    get.mockImplementation((path) =>
        Promise.resolve(
            envelope(path === '/v1/banners' ? banners : detail(String(path).split('/').at(-1)!)),
        ),
    );
});
afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
});

describe('홈 관리 배너', () => {
    it('키보드로 재시작하면 포커스를 유지한 채 재생하고 다음 포커스 이동에서 정지한다', async () => {
        vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
        const user = userEvent.setup();
        mount();
        await screen.findByRole('link', { name: '일반 이벤트 상세 보기' });
        act(() => screen.getByRole('button', { name: '자동 재생 정지' }).focus());
        expect(screen.getByRole('button', { name: '자동 재생 정지' })).toHaveFocus();
        await user.keyboard('{Enter}');
        await user.keyboard('{Enter}');
        expect(screen.getByRole('button', { name: '자동 재생 정지' })).toHaveFocus();

        await act(() => vi.advanceTimersByTimeAsync(5_000));
        expect(screen.getByRole('link', { name: '겟또타임 이벤트 상세 보기' })).toBeInTheDocument();

        await user.tab({ shift: true });
        expect(screen.getByRole('link', { name: '겟또타임 이벤트 상세 보기' })).toHaveFocus();
        await act(() => vi.advanceTimersByTimeAsync(5_000));
        expect(screen.getByRole('link', { name: '겟또타임 이벤트 상세 보기' })).toBeInTheDocument();
    });

    it('B01의 비연속 상대 순서와 이미지를 유지하고 이벤트 유형별 상세로 이동한다', async () => {
        const user = userEvent.setup();
        const { container } = mount();
        expect(await screen.findByRole('link', { name: '일반 이벤트 상세 보기' })).toHaveAttribute(
            'href',
            '/events/free',
        );
        expect(
            [...container.querySelectorAll('img')].map((img) => img.getAttribute('src')),
        ).toEqual(['/first.png', '/second.png']);
        await user.click(screen.getByRole('button', { name: '다음 배너' }));
        expect(screen.getByRole('link', { name: '겟또타임 이벤트 상세 보기' })).toHaveAttribute(
            'href',
            '/time-raffle/ticket',
        );
        expect(container.querySelector('[inert] a')).toHaveAttribute('href', '/events/free');
    });

    it('빈 목록은 영역을 숨긴다', async () => {
        get.mockResolvedValue(envelope([]));
        mount();
        await waitFor(() =>
            expect(screen.queryByText('배너를 불러오는 중입니다.')).not.toBeInTheDocument(),
        );
        expect(screen.queryByRole('region', { name: '관리 배너' })).not.toBeInTheDocument();
    });

    it('목록 조회 실패를 알리고 재시도로 복구한다', async () => {
        get.mockRejectedValueOnce(new Error('network'));
        const user = userEvent.setup();
        mount();
        expect(await screen.findByText('배너를 불러오지 못했습니다.')).toBeInTheDocument();
        await user.click(screen.getByRole('button', { name: '배너 다시 불러오기' }));
        expect(
            await screen.findByRole('link', { name: '일반 이벤트 상세 보기' }),
        ).toBeInTheDocument();
    });

    it('이미지 실패를 안내하며 이벤트 상세 링크는 유지한다', async () => {
        mount();
        const link = await screen.findByRole('link', { name: '일반 이벤트 상세 보기' });
        fireEvent.error(within(link).getByRole('img'));
        expect(screen.getByText('배너 이미지를 불러오지 못했습니다.')).toBeInTheDocument();
        expect(link).toHaveAttribute('href', '/events/free');
    });

    it('연결 이벤트 실패 시 잘못된 링크를 막고 재시도로 복구한다', async () => {
        get.mockImplementation((path) => {
            if (path === '/v1/banners') return Promise.resolve(envelope(banners.slice(0, 1)));
            return Promise.reject(new Error('event'));
        });
        const user = userEvent.setup();
        mount();
        expect(await screen.findByText('연결 이벤트를 불러오지 못했습니다.')).toBeInTheDocument();
        expect(screen.queryByRole('link')).not.toBeInTheDocument();
        get.mockImplementation(() => Promise.resolve(envelope(detail('free'))));
        await user.click(screen.getByRole('button', { name: '연결 이벤트 다시 불러오기' }));
        expect(
            await screen.findByRole('link', { name: '일반 이벤트 상세 보기' }),
        ).toBeInTheDocument();
    });

    it('키보드로 넘길 수 있고 포커스·명시적 정지 후 자동 재생하지 않는다', async () => {
        vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
        const user = userEvent.setup();
        mount();
        await screen.findByRole('link', { name: '일반 이벤트 상세 보기' });
        await user.click(screen.getByRole('button', { name: '자동 재생 정지' }));
        screen.getByRole('button', { name: '다음 배너' }).focus();
        await user.keyboard('{Enter}');
        expect(screen.getByRole('link', { name: '겟또타임 이벤트 상세 보기' })).toBeInTheDocument();

        await act(() => vi.advanceTimersByTimeAsync(10_000));
        expect(screen.getByRole('link', { name: '겟또타임 이벤트 상세 보기' })).toBeInTheDocument();
    });

    it('자동 재생으로 다음 배너를 표시한다', async () => {
        vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
        mount();
        await screen.findByRole('link', { name: '일반 이벤트 상세 보기' });

        await act(() => vi.advanceTimersByTimeAsync(5_000));
        expect(screen.getByRole('link', { name: '겟또타임 이벤트 상세 보기' })).toBeInTheDocument();
    });

    it('호버가 끝나도 내부 포커스가 남으면 자동 재생을 멈춘다', async () => {
        vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
        mount();
        const link = await screen.findByRole('link', { name: '일반 이벤트 상세 보기' });
        const region = screen.getByRole('region', { name: '관리 배너' });
        fireEvent.mouseEnter(region);

        await act(() => vi.advanceTimersByTimeAsync(5_000));
        expect(link).toBeVisible();
        act(() => link.focus());
        fireEvent.mouseLeave(region);
        await act(() => vi.advanceTimersByTimeAsync(5_000));
        expect(screen.getByRole('link', { name: '일반 이벤트 상세 보기' })).toBeInTheDocument();
    });

    it('동작 줄이기 환경은 수동 넘김만 제공한다', async () => {
        vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
        motion.reduced = true;
        mount();
        await screen.findByRole('link', { name: '일반 이벤트 상세 보기' });
        expect(screen.queryByRole('button', { name: '자동 재생 정지' })).not.toBeInTheDocument();

        await act(() => vi.advanceTimersByTimeAsync(10_000));
        expect(screen.getByRole('link', { name: '일반 이벤트 상세 보기' })).toBeInTheDocument();
    });
});
