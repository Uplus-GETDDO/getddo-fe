import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import { VirtualClockContext } from '@shared/model/virtualClock';

import { EventDetailPage } from './EventDetailPage';

/*
 * 대표 이미지만 있고 시연용 상세 이미지·캠페인 비주얼이 없는 진행 중 이벤트.
 * 실서버가 주는 값이 imageUrl뿐이라(detailImageUrl·detailVisual은 목업 전용) 이쪽이 실제 모습이다.
 */
const BANNER_EVENT_ID = 'evt-203';
const BANNER_SRC = '/images/events/banners/muno-calendar.svg';

function renderPage(eventId: string) {
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
                <MemoryRouter initialEntries={[`/events/${eventId}`]}>
                    <Routes>
                        <Route path="/events/:id" element={<EventDetailPage />} />
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
