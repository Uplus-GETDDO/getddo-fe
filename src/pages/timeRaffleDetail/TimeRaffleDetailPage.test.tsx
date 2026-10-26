import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import { apiClient } from '@shared/api/client';
import { VirtualClockContext } from '@shared/model/virtualClock';
import { createIdempotencyKey, IDEMPOTENCY_HEADER } from '@shared/utils/idempotencyKey';

import { server } from '../../mocks/server';
import { TimeRaffleDetailPage } from './TimeRaffleDetailPage';

// 진행 중 이벤트 — evt-011은 미사용, evt-003은 브론즈 1장 미적용, evt-014는 vip 제한이다
const FREE_EVENT_ID = 'evt-011';
const BRONZE_ONLY_EVENT_ID = 'evt-003';
const VIP_EVENT_ID = 'evt-014';

function renderPage(eventId: string) {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
        <QueryClientProvider client={client}>
            <VirtualClockContext.Provider
                value={{
                    now: () => new Date(),
                    setOverride: () => {},
                    override: null,
                    isOverridden: false,
                }}
            >
                <MemoryRouter initialEntries={[`/time-raffle/${eventId}`]}>
                    <Routes>
                        <Route path="/time-raffle/:id" element={<TimeRaffleDetailPage />} />
                    </Routes>
                </MemoryRouter>
            </VirtualClockContext.Provider>
        </QueryClientProvider>,
    );
    return { client };
}

// 화면의 모든 쿼리가 가라앉을 때까지 — E07 도착 후 상태를 단정하려면 기다려야 한다
async function settle(client: QueryClient) {
    await waitFor(() => expect(client.isFetching()).toBe(0));
}

/** 관리자 목업으로 진행 중 이벤트를 만든다 — 사용자의 브론즈를 소진할 상한 없는 이벤트용 */
async function createOpenWeightedEvent() {
    const res = await apiClient.post('/v1/admin/events', {
        title: '브론즈 소진용 이벤트',
        description: '테스트용 이벤트입니다',
        imageKey: null,
        eventType: 'TICKET',
        weightingEnabled: true,
        maxTicketsPerUser: null,
        membershipRule: 'excellent',
        startsAt: '2026-01-01T00:00:00Z',
        endsAt: '2026-12-31T00:00:00Z',
        prizes: [
            { rank: 1, name: '테스트 경품', winnerCount: 1, description: null, imageKey: null },
        ],
    });
    return (res.data as { data: { id: string } }).data.id;
}

describe('TimeRaffleDetailPage의 E07 사유별 버튼', () => {
    it('상세 갱신 실패 때 기존 이벤트 화면을 유지한다', async () => {
        const { client } = renderPage(FREE_EVENT_ID);
        await settle(client);
        server.use(
            http.get(`*/v1/events/${FREE_EVENT_ID}`, () => HttpResponse.json({}, { status: 403 })),
        );
        await act(() => client.refetchQueries({ queryKey: ['events', 'detail', FREE_EVENT_ID] }));
        await waitFor(() =>
            expect(client.getQueryState(['events', 'detail', FREE_EVENT_ID])?.status).toBe('error'),
        );
        expect(screen.getByRole('button', { name: '응모하기' })).toBeInTheDocument();
        expect(
            screen.getByText('겟또타임 정보를 갱신하지 못했어요. 이전 정보를 표시해요.'),
        ).toBeInTheDocument();
        server.resetHandlers();
        await userEvent.click(screen.getByRole('button', { name: '겟또타임 정보 다시 시도' }));
        await waitFor(() =>
            expect(
                screen.queryByText('겟또타임 정보를 갱신하지 못했어요. 이전 정보를 표시해요.'),
            ).not.toBeInTheDocument(),
        );
        client.clear();
    });

    it('공개 결과 최초 조회가 실패하고 미응모 상태이면 발표 대기를 추측하지 않는다', async () => {
        server.use(
            http.get('*/v1/events/evt-001/results', () => HttpResponse.json({}, { status: 403 })),
            http.get('*/v1/events/evt-001/my-result', () =>
                HttpResponse.json({
                    success: true,
                    data: {
                        eventId: 'evt-001',
                        result: 'NOT_ENTERED',
                        prize: null,
                        isPublished: false,
                        revision: null,
                        serverTime: new Date().toISOString(),
                    },
                }),
            ),
        );
        const { client } = renderPage('evt-001');
        await settle(client);
        const cached = client.getQueryData<Record<string, unknown>>([
            'events',
            'detail',
            'evt-001',
        ]);
        await act(() =>
            client.setQueryData(['events', 'detail', 'evt-001'], { ...cached, status: 'CLOSED' }),
        );
        await screen.findByRole('button', { name: '당첨자 명단 다시 불러오기' });
        expect(screen.queryByText('아직 발표 전이에요')).not.toBeInTheDocument();
        client.clear();
    });

    it('당첨자 명단과 내 결과 갱신 실패에도 이전 결과를 유지한다', async () => {
        const { client } = renderPage('evt-001');
        await settle(client);
        const cached = client.getQueryData<Record<string, unknown>>([
            'events',
            'detail',
            'evt-001',
        ]);
        await act(() =>
            client.setQueryData(['events', 'detail', 'evt-001'], { ...cached, status: 'CLOSED' }),
        );
        await waitFor(() => {
            expect(client.getQueryData(['draw-results', 'evt-001'])).toBeDefined();
            expect(client.getQueryData(['draw-results', 'evt-001', 'me'])).toBeDefined();
        });
        expect(screen.queryByText(/마지막 조회/)).not.toBeInTheDocument();
        const previous = client.getQueryData(['draw-results', 'evt-001']);
        const myPrevious = client.getQueryData(['draw-results', 'evt-001', 'me']);
        const updatedAt = client.getQueryState(['draw-results', 'evt-001'])?.dataUpdatedAt;
        server.use(
            http.get('*/v1/events/evt-001/results', () => HttpResponse.json({}, { status: 403 })),
            http.get('*/v1/events/evt-001/my-result', () => HttpResponse.json({}, { status: 403 })),
        );
        await act(() => client.refetchQueries({ queryKey: ['draw-results', 'evt-001'] }));
        expect(
            await screen.findByRole('button', { name: '당첨자 명단 다시 불러오기' }),
        ).toBeEnabled();
        expect(await screen.findByRole('button', { name: '내 결과 다시 불러오기' })).toBeEnabled();
        expect(client.getQueryData(['draw-results', 'evt-001'])).toEqual(previous);
        expect(client.getQueryData(['draw-results', 'evt-001', 'me'])).toEqual(myPrevious);
        expect(client.getQueryState(['draw-results', 'evt-001'])?.dataUpdatedAt).toBe(updatedAt);
        expect(screen.getByText('아직 발표 전이에요')).toBeInTheDocument();
        client.clear();
    });

    it.each([
        ['CANCELED', '이벤트가 취소되어 당첨자를 발표하지 않아요.'],
        ['NO_ENTRANTS', '응모자가 없어 추첨이 종료됐어요.'],
    ])('미공개 %s 결과에는 발표 대기 카드를 표시하지 않는다', async (displayStatus, notice) => {
        server.use(
            http.get('*/v1/events/evt-001/results', () =>
                HttpResponse.json({
                    success: true,
                    data: {
                        eventId: 'evt-001',
                        isPublished: false,
                        publishedAt: null,
                        revision: null,
                        updatedAt: null,
                        serverTime: new Date().toISOString(),
                        displayStatus,
                        prizes: [],
                    },
                }),
            ),
        );
        const { client } = renderPage('evt-001');
        await settle(client);
        const cached = client.getQueryData<Record<string, unknown>>([
            'events',
            'detail',
            'evt-001',
        ]);
        await act(() =>
            client.setQueryData(['events', 'detail', 'evt-001'], { ...cached, status: 'CLOSED' }),
        );
        await settle(client);
        expect(await screen.findByText(notice)).toBeInTheDocument();
        expect(screen.queryByText('아직 발표 전이에요')).not.toBeInTheDocument();
        client.clear();
    });
    it('멤버십이 미달이면 버튼이 "응모할 수 없어요"로 잠긴다', async () => {
        const { client } = renderPage(VIP_EVENT_ID);

        // E07 도착 전에는 로컬 근사로 열려 있다가, 판정이 오면 잠긴다
        await settle(client);
        const button = screen.getByRole('button', { name: '응모할 수 없어요' });
        expect(button).toBeDisabled();
    });

    it('이미 응모한 이벤트는 "응모 완료"로 잠긴다', async () => {
        await apiClient.post(
            `/v1/events/${FREE_EVENT_ID}/entries`,
            { tickets: {} },
            { headers: { [IDEMPOTENCY_HEADER]: createIdempotencyKey() } },
        );

        const { client } = renderPage(FREE_EVENT_ID);
        await settle(client);

        const button = screen.getByRole('button', { name: '응모 완료' });
        expect(button).toBeDisabled();
    });

    it('브론즈가 모자라도 버튼은 열려 있고 누르면 브론즈 필요 안내가 뜬다', async () => {
        // 익명 사용자의 브론즈 7장을 상한 없는 이벤트로 전부 소진한다
        const drainId = await createOpenWeightedEvent();
        await apiClient.post(
            `/v1/events/${drainId}/entries`,
            { tickets: { BRONZE: 7 } },
            { headers: { [IDEMPOTENCY_HEADER]: createIdempotencyKey() } },
        );

        const { client } = renderPage(BRONZE_ONLY_EVENT_ID);
        await settle(client);

        // E07이 BRONZE_REQUIRED를 돌려줘도 '응모 완료'가 아니라 열려 있어야 한다
        const button = screen.getByRole('button', { name: '응모하기' });
        expect(button).toBeEnabled();

        const user = userEvent.setup();
        await user.click(button);
        expect(await screen.findByText('브론즈 응모권이 필요해요')).toBeInTheDocument();
    });
});
