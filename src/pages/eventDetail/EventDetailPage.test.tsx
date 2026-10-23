import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import { VirtualClockContext } from '@shared/model/virtualClock';

import { server } from '../../mocks/server';
import { EventDetailPage } from './EventDetailPage';

/*
 * 대표 이미지만 있고 시연용 상세 이미지·캠페인 비주얼이 없는 진행 중 이벤트.
 * 실서버가 주는 값이 imageUrl뿐이라(detailImageUrl·detailVisual은 목업 전용) 이쪽이 실제 모습이다.
 */
const BANNER_EVENT_ID = 'evt-203';
const BANNER_SRC = '/images/events/banners/muno-calendar.svg';

function renderPage(eventId: string, path = `/events/${eventId}`) {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { container } = render(
        <QueryClientProvider client={client}>
            <VirtualClockContext.Provider
                value={{
                    now: () => new Date(),
                    setOverride: () => {},
                    override: null,
                    isOverridden: false,
                }}
            >
                <MemoryRouter initialEntries={[path]}>
                    <Routes>
                        <Route path="/events/:id" element={<EventDetailPage />} />
                        <Route path="/events/:id/results" element={<EventDetailPage />} />
                        {/* 돌려보냈는지만 보면 되므로 겟또타임 상세 대신 표지를 세운다 */}
                        <Route path="/time-raffle/:id" element={<p>겟또타임 상세</p>} />
                    </Routes>
                </MemoryRouter>
            </VirtualClockContext.Provider>
        </QueryClientProvider>,
    );
    return { client, container };
}

/** 화면의 모든 쿼리가 가라앉을 때까지 — 자격·발표 조회가 뒤따라 온다 */
async function settle(client: QueryClient) {
    await waitFor(() => expect(client.isFetching()).toBe(0));
}

/*
 * 이 화면은 장수를 고를 수 없어 브론즈 1장으로 고정해 보낸다. 응모권을 쓰는 이벤트가 그대로
 * 그려지면 '등급을 골라 최대 N장까지 나눠서 응모'라고 안내해 놓고 1장만 내는 꼴이 된다.
 * 목록·홈은 래플을 /time-raffle로 보내지만 서버 알림의 linkUrl이 /events/{id}를 쓴다.
 */
describe('EventDetailPage가 겟또타임으로 돌려보내는 범위', () => {
    it('등급을 고르는 가중치 이벤트는 겟또타임 상세로 보낸다', async () => {
        const { client } = renderPage('evt-002');
        await settle(client);
        expect(await screen.findByText('겟또타임 상세')).toBeInTheDocument();
    });

    // 규칙 자체가 브론즈 1장이라 이 화면이 보내는 값과 어긋나지 않는다
    it('가중치를 쓰지 않는 응모권 이벤트는 이 화면에 남는다', async () => {
        const { client } = renderPage('evt-003');
        await settle(client);
        expect(await screen.findByRole('heading', { level: 1 })).toBeInTheDocument();
        expect(screen.queryByText('겟또타임 상세')).not.toBeInTheDocument();
    });

    // 발표 알림이 쓰는 경로다 — 겟또타임 상세도 같은 결과 영역을 보여 준다
    it('발표 결과 경로로 들어와도 돌려보낸다', async () => {
        const { client } = renderPage('evt-002', '/events/evt-002/results');
        await settle(client);
        expect(await screen.findByText('겟또타임 상세')).toBeInTheDocument();
    });

    it('응모권 미사용 이벤트는 이 화면에 남는다', async () => {
        const { client } = renderPage(BANNER_EVENT_ID);
        await settle(client);
        expect(await screen.findByRole('heading', { level: 1 })).toBeInTheDocument();
        expect(screen.queryByText('겟또타임 상세')).not.toBeInTheDocument();
    });
});

/*
 * 끝났거나 지워진 이벤트를 가리키는 알림이 실서버에 남아 있어(2026-10-23 확인) 사용자가
 * 404로 들어온다. 문구 한 줄만 남기면 되돌아갈 데가 없는 막다른 화면이 된다.
 */
describe('EventDetailPage의 불러오기 실패 화면', () => {
    it('없는 이벤트는 찾을 수 없다고 알리고 목록으로 보낸다', async () => {
        server.use(
            http.get('*/v1/events/:eventId', () =>
                HttpResponse.json({ code: 'EVENT-007', message: '없음' }, { status: 404 }),
            ),
        );
        const { client } = renderPage('evt-203');
        await settle(client);

        expect(
            await screen.findByRole('heading', { name: '이벤트를 찾을 수 없어요' }),
        ).toBeInTheDocument();
        expect(screen.getByRole('link', { name: '이벤트 목록으로' })).toHaveAttribute(
            'href',
            '/events',
        );
        // 눌러도 달라지지 않는 길은 권하지 않는다
        expect(screen.queryByRole('button', { name: '다시 시도' })).not.toBeInTheDocument();
    });

    it('일시적인 실패는 다시 시도할 수 있게 둔다', async () => {
        server.use(
            http.get('*/v1/events/:eventId', () =>
                HttpResponse.json({ code: 'COMMON-001', message: '서버 오류' }, { status: 500 }),
            ),
        );
        const { client } = renderPage('evt-203');
        await settle(client);

        expect(
            await screen.findByRole('heading', { name: '이벤트를 불러오지 못했어요' }),
        ).toBeInTheDocument();
        expect(screen.getByRole('button', { name: '다시 시도' })).toBeEnabled();
        expect(screen.getByRole('link', { name: '이벤트 목록으로' })).toBeInTheDocument();
    });
});

describe('EventDetailPage의 대표 이미지', () => {
    /*
     * 상세 화면이 그리던 것은 시연 전용 필드(detailImageUrl·detailVisual)뿐이어서, 관리자가
     * 올린 대표 이미지가 목록 카드에만 보이고 눌러 들어가면 사라졌다.
     */
    it('올린 대표 이미지를 상세에도 보인다', async () => {
        const { client, container } = renderPage(BANNER_EVENT_ID);
        await settle(client);

        await screen.findByRole('heading', { level: 1 });
        expect(container.querySelector(`img[src="${BANNER_SRC}"]`)).not.toBeNull();
    });
});
