import type { ReactNode } from 'react';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { delay, http, HttpResponse } from 'msw';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { TICKETS_KEY } from '@entities/ticket';
import { useSessionStore } from '@entities/user';
import { server } from '@mocks/server';
import { EventDetailPage } from '@pages/eventDetail/EventDetailPage';
import { MyPage } from '@pages/myPage/MyPage';
import { MyTicketsPage } from '@pages/myTickets/MyTicketsPage';
import { TimeRaffleDetailPage } from '@pages/timeRaffleDetail/TimeRaffleDetailPage';
import { apiClient } from '@shared/api/client';
import { VirtualClockContext } from '@shared/model/virtualClock';
import { TicketWallet } from '@widgets/ticketWallet';

const balancePath = '*/v1/tickets/me';
const balanceKey = [...TICKETS_KEY, 'me'];
const now = new Date('2026-10-19T07:00:00Z');
const balance = (count = 17) => ({
    availableCount: count,
    countByGrade: { BRONZE: count, SILVER: 0, GOLD: 0, PLATINUM: 0 },
    holdings: count ? [{ grade: 'BRONZE', count, expiresAt: '2026-10-31T15:00:00Z' }] : [],
    serverTime: now.toISOString(),
});
const ok = (data: unknown) =>
    HttpResponse.json({ success: true, code: 'SUCCESS', message: '성공했습니다.', data });
const httpFailure = () =>
    HttpResponse.json(
        { success: false, code: 'COMMON-001', message: '내부 정보', data: null },
        { status: 500 },
    );
const contractFailure = () =>
    ok({ ...balance(), countByGrade: { BRONZE: 17, SILVER: 0, GOLD: 0 } });

function renderContent(content: ReactNode, eventId?: string) {
    const client = new QueryClient({
        defaultOptions: { queries: { retry: false, staleTime: 60_000 } },
    });
    render(
        <QueryClientProvider client={client}>
            <VirtualClockContext.Provider
                value={{
                    now: () => now,
                    setOverride: () => {},
                    override: null,
                    isOverridden: false,
                }}
            >
                <MemoryRouter initialEntries={[eventId ? `/${eventId}` : '/']}>
                    <Routes>
                        <Route path="/:id?" element={content} />
                    </Routes>
                </MemoryRouter>
            </VirtualClockContext.Provider>
        </QueryClientProvider>,
    );
    return client;
}

let userSequence = 0;
beforeEach(() => {
    vi.stubGlobal('matchMedia', () => ({
        matches: true,
        addEventListener: () => {},
        removeEventListener: () => {},
    }));
    apiClient.defaults.headers.common['X-User-ID'] = `balance-test-${++userSequence}`;
    useSessionStore.getState().selectUser({
        id: 'ticket-balance-test',
        name: '잔액 테스트 사용자',
        role: 'USER',
        membership: 'excellent',
        personaLabel: null,
    });
});
afterEach(() => {
    vi.unstubAllGlobals();
    delete apiClient.defaults.headers.common['X-User-ID'];
    useSessionStore.getState().signOut();
});

describe('응모권 잔액 표시 화면', () => {
    const wallet = <TicketWallet now={now} action={{ to: '/my-tickets', label: '내역' }} />;

    it('지연 중 로딩을 안내하고 정상 0장을 오류 없이 표시한다', async () => {
        server.use(
            http.get(balancePath, async () => {
                await delay(100);
                return ok(balance(0));
            }),
        );
        renderContent(wallet);
        expect(screen.getByRole('status')).toHaveTextContent('응모권 잔액을 불러오는 중이에요.');
        expect((await screen.findAllByText('0장')).length).toBeGreaterThan(0);
        expect(screen.queryByRole('alert')).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: '다시 시도' })).not.toBeInTheDocument();
    });

    it.each([
        ['HTTP', httpFailure, '서버 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.'],
        ['계약', contractFailure, '잠시 후 다시 시도해 주세요.'],
        ['네트워크', () => HttpResponse.error(), '인터넷 연결을 확인한 뒤 다시 시도해 주세요.'],
    ])('%s 실패를 구분하고 재조회로 복구한다', async (_kind, failure, message) => {
        server.use(http.get(balancePath, failure));
        renderContent(wallet);
        const alert = await screen.findByRole('alert');
        expect(alert).toHaveTextContent('응모권 잔액을 불러오지 못했어요.');
        expect(alert).toHaveTextContent(message);
        expect(alert).not.toHaveTextContent('내부 정보');
        expect(alert).not.toHaveTextContent('형식');
        server.use(http.get(balancePath, () => ok(balance())));
        await userEvent.click(screen.getByRole('button', { name: '다시 시도' }));
        expect((await screen.findAllByText('17장')).length).toBeGreaterThan(0);
        expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    it.each([
        ['미션 지갑', wallet],
        ['내 응모권', <MyTicketsPage />],
        ['마이페이지', <MyPage />],
    ])('%s에서 이전 잔액을 보존하고 갱신 실패 뒤 복구한다', async (_name, content) => {
        server.use(http.get(balancePath, () => ok(balance())));
        const client = renderContent(content);
        expect((await screen.findAllByText('17장')).length).toBeGreaterThan(0);
        server.use(
            http.get(balancePath, async () => {
                await delay(100);
                return httpFailure();
            }),
        );
        let refresh: Promise<void>;
        act(() => {
            refresh = client.refetchQueries({ queryKey: balanceKey });
        });
        // 다시 받는 중에는 안내 줄 없이 받아 둔 잔액을 그대로 둔다
        expect(screen.getAllByText('17장').length).toBeGreaterThan(0);
        expect(screen.queryByRole('alert')).not.toBeInTheDocument();
        await act(async () => {
            await refresh;
        });
        // 받아 둔 잔액이 있으면 빨간 문단 대신 작은 갱신 실패 표시만
        const stale = await screen.findByRole('button', { name: '잔액 갱신 실패. 다시 받기' });
        expect(screen.queryByRole('alert')).not.toBeInTheDocument();
        expect(screen.getAllByText('17장').length).toBeGreaterThan(0);
        server.use(http.get(balancePath, () => ok(balance(0))));
        await userEvent.click(stale);
        await waitFor(() =>
            expect(
                screen.queryByRole('button', { name: '잔액 갱신 실패. 다시 받기' }),
            ).not.toBeInTheDocument(),
        );
        expect(screen.getAllByText('0장').length).toBeGreaterThan(0);
    });

    it.each([
        ['내 응모권', <MyTicketsPage />],
        ['마이페이지', <MyPage />],
    ])('%s의 최초 오류에서도 재조회할 수 있다', async (_name, content) => {
        server.use(http.get(balancePath, httpFailure));
        renderContent(content);
        expect(await screen.findByRole('alert')).toHaveTextContent(
            '응모권 잔액을 불러오지 못했어요.',
        );
        const retry = screen.getByRole('button', { name: '다시 시도' });
        expect(retry.closest('a')).toBeNull();
        server.use(http.get(balancePath, () => ok(balance(0))));
        await userEvent.click(retry);
        expect((await screen.findAllByText('0장')).length).toBeGreaterThan(0);
    });
});

describe('응모권 갱신 경계', () => {
    const wallet = <TicketWallet now={now} action={{ to: '/my-tickets', label: '내역' }} />;

    it('200 계약 오류로 갱신에 실패해도 이전 등급별 잔액을 보존한다', async () => {
        server.use(http.get(balancePath, () => ok(balance())));
        const client = renderContent(wallet);
        await screen.findAllByText('17장');
        server.use(http.get(balancePath, contractFailure));
        await act(async () => {
            await client.refetchQueries({ queryKey: balanceKey });
        });
        expect(
            await screen.findByRole('button', { name: '잔액 갱신 실패. 다시 받기' }),
        ).toBeInTheDocument();
        expect(screen.queryByText(/형식/)).not.toBeInTheDocument();
        expect(screen.getAllByText('17장')).toHaveLength(2);
    });

    it('키보드로 재조회할 수 있고 재조회 중에는 중복 클릭을 잠근다', async () => {
        server.use(http.get(balancePath, httpFailure));
        renderContent(wallet);
        const retry = await screen.findByRole('button', { name: '다시 시도' });
        let requests = 0;
        server.use(
            http.get(balancePath, async () => {
                requests += 1;
                await delay(200);
                return ok(balance(0));
            }),
        );
        retry.focus();
        await userEvent.keyboard('{Enter}');
        const pending = await screen.findByRole('button', { name: '다시 불러오는 중…' });
        expect(pending).toBeDisabled();
        await userEvent.click(pending);
        await screen.findAllByText('0장');
        expect(requests).toBe(1);
    });
});

describe('응모권 잔액과 응모 안전성', () => {
    it.each([
        ['가중치 래플', <TimeRaffleDetailPage />, 'evt-002'],
        ['브론즈 고정 래플', <TimeRaffleDetailPage />, 'evt-003'],
        ['이벤트 상세', <EventDetailPage />, 'evt-003'],
    ])('%s에서 최초 실패 중 제출하지 않고 재조회 후 응모할 수 있다', async (_name, page, id) => {
        let requests = 0;
        server.use(
            http.get(balancePath, contractFailure),
            http.post('*/v1/events/:id/entries', () => {
                requests += 1;
            }),
        );
        const client = renderContent(page, id);
        await waitFor(() => expect(client.isFetching()).toBe(0));
        expect(await screen.findByRole('alert')).toHaveTextContent(
            '응모권 잔액을 불러오지 못했어요.',
        );
        expect(
            screen.queryByRole('button', { name: '응모권을 골라주세요' }),
        ).not.toBeInTheDocument();
        expect(screen.queryAllByText('보유 -')).toHaveLength(0);
        const blocked = screen.getByRole('button', { name: '응모권 잔액을 다시 조회해 주세요' });
        expect(blocked).toBeDisabled();
        await userEvent.click(blocked);
        expect(requests).toBe(0);
        server.use(http.get(balancePath, () => ok(balance())));
        await userEvent.click(screen.getByRole('button', { name: '다시 시도' }));
        await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument());
        if (id === 'evt-002') {
            await userEvent.click(screen.getByRole('button', { name: '브론즈 응모 수량 늘리기' }));
        }
        await userEvent.click(screen.getByRole('button', { name: '응모하기' }));
        await userEvent.click(
            within(screen.getByRole('dialog')).getByRole('button', { name: '응모하기' }),
        );
        await waitFor(() => expect(requests).toBe(1));
        await waitFor(() => expect(client.isMutating()).toBe(0));
    });

    it('최초 로딩에는 수량 입력과 응모를 잠근다', async () => {
        server.use(
            http.get(balancePath, async () => {
                await delay(300);
                return ok(balance());
            }),
        );
        renderContent(<TimeRaffleDetailPage />, 'evt-002');
        const input = await screen.findByRole('textbox', { name: '브론즈 응모 수량' });
        expect(input).toBeDisabled();
        expect(
            screen.getByRole('button', { name: '응모권 잔액을 확인하는 중이에요' }),
        ).toBeDisabled();
        await waitFor(() => expect(input).toBeEnabled());
    });

    it('선택 후 갱신 실패에는 값은 남기고 증감과 입력을 잠근다', async () => {
        server.use(http.get(balancePath, () => ok(balance())));
        const client = renderContent(<TimeRaffleDetailPage />, 'evt-002');
        await waitFor(() => expect(client.isFetching()).toBe(0));
        await userEvent.click(screen.getByRole('button', { name: '브론즈 응모 수량 늘리기' }));
        server.use(
            http.get(balancePath, async () => {
                await delay(100);
                return httpFailure();
            }),
        );
        let refresh: Promise<void>;
        act(() => {
            refresh = client.refetchQueries({ queryKey: balanceKey });
        });
        expect(
            await screen.findByRole('button', { name: '응모권 잔액을 확인하는 중이에요' }),
        ).toBeDisabled();
        expect(screen.getByRole('textbox', { name: '브론즈 응모 수량' })).toBeDisabled();
        await act(async () => {
            await refresh;
        });
        const stale = await screen.findByRole('button', { name: '잔액 갱신 실패. 다시 받기' });
        expect(screen.getByRole('textbox', { name: '브론즈 응모 수량' })).toHaveValue('1');
        expect(screen.getByRole('textbox', { name: '브론즈 응모 수량' })).toBeDisabled();
        expect(screen.getByRole('button', { name: '브론즈 응모 수량 줄이기' })).toBeDisabled();
        expect(screen.getByRole('button', { name: '브론즈 응모 수량 늘리기' })).toBeDisabled();
        server.use(http.get(balancePath, () => ok(balance())));
        await userEvent.click(stale);
        await waitFor(() =>
            expect(screen.getByRole('textbox', { name: '브론즈 응모 수량' })).toBeEnabled(),
        );
        expect(screen.getByRole('button', { name: '응모하기' })).toBeEnabled();
    });

    it.each([
        ['래플', <TimeRaffleDetailPage />],
        ['이벤트', <EventDetailPage />],
    ])('%s의 확인 모달을 연 뒤 갱신 실패해도 차감 요청을 보내지 않는다', async (_name, page) => {
        let requests = 0;
        server.use(
            http.get(balancePath, () => ok(balance())),
            http.post('*/v1/events/:id/entries', () => {
                requests += 1;
            }),
        );
        const client = renderContent(page, 'evt-003');
        await waitFor(() => expect(client.isFetching()).toBe(0));
        await userEvent.click(screen.getByRole('button', { name: '응모하기' }));
        const dialog = screen.getByRole('dialog');
        server.use(http.get(balancePath, httpFailure));
        await act(async () => {
            await client.refetchQueries({ queryKey: balanceKey });
        });
        await userEvent.click(within(dialog).getByRole('button', { name: '응모하기' }));
        expect(requests).toBe(0);
        expect(client.isMutating()).toBe(0);
    });

    it('복구된 잔액보다 많은 선택은 제출을 막고 줄인 뒤 다시 선택할 수 있다', async () => {
        server.use(
            http.get(balancePath, () => ok(balance())),
            http.get('*/v1/events/evt-002/eligibility', () =>
                ok({
                    eventId: 'evt-002',
                    canEnter: true,
                    reasons: [],
                    usedTicketCount: 0,
                    remainingTicketLimit: 5,
                    availableTicketBalance: 17,
                    serverTime: now.toISOString(),
                }),
            ),
        );
        const client = renderContent(<TimeRaffleDetailPage />, 'evt-002');
        await waitFor(() => expect(client.isFetching()).toBe(0));
        const input = screen.getByRole('textbox', { name: '브론즈 응모 수량' });
        await userEvent.click(input);
        await userEvent.keyboard('3');
        expect(input).toHaveValue('3');
        server.use(http.get(balancePath, () => ok(balance(1))));
        await act(async () => {
            await client.refetchQueries({ queryKey: balanceKey });
        });
        expect(
            await screen.findByRole('button', { name: '응모 수량을 다시 확인해 주세요' }),
        ).toBeDisabled();
        await userEvent.click(screen.getByRole('button', { name: '브론즈 응모 수량 줄이기' }));
        await userEvent.click(screen.getByRole('button', { name: '브론즈 응모 수량 줄이기' }));
        expect(screen.getByRole('button', { name: '응모하기' })).toBeEnabled();
    });

    it.each([
        ['래플', <TimeRaffleDetailPage />],
        ['이벤트', <EventDetailPage />],
    ])('%s의 응모권 미사용 이벤트는 잔액 장애 때문에 막지 않는다', async (_name, page) => {
        server.use(http.get(balancePath, httpFailure));
        const client = renderContent(page, 'evt-011');
        await waitFor(() => expect(client.isFetching()).toBe(0));
        expect(screen.getByRole('button', { name: '응모하기' })).toBeEnabled();
        await userEvent.click(screen.getByRole('button', { name: '응모하기' }));
        expect(screen.getByRole('dialog')).toHaveTextContent('응모권 없이 참여하는 이벤트예요.');
    });

    it('확인 중 잔액이 줄면 제출을 잠그고 수량 조정을 안내한다', async () => {
        server.use(http.get(balancePath, () => ok(balance())));
        const client = renderContent(<TimeRaffleDetailPage />, 'evt-002');
        await waitFor(() => expect(client.isFetching()).toBe(0));
        await userEvent.click(screen.getByRole('button', { name: '브론즈 응모 수량 늘리기' }));
        await userEvent.click(screen.getByRole('button', { name: '응모하기' }));
        server.use(http.get(balancePath, () => ok(balance(0))));
        await act(async () => {
            await client.refetchQueries({ queryKey: balanceKey });
        });
        const dialog = screen.getByRole('dialog');
        expect(
            await within(dialog).findByText(
                '응모 수량을 다시 확인해 주세요. 취소한 뒤 수량을 조정해 주세요.',
            ),
        ).toBeInTheDocument();
        expect(within(dialog).getByRole('button', { name: '응모하기' })).toBeDisabled();
    });
});
