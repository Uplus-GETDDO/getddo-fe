import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { Notification } from '@entities/notification';

import { apiClient } from '@shared/api/client';
import { VirtualClockProvider } from '@shared/model/virtualClock';

import { NotificationDrawer } from './NotificationDrawer';

let userSeq = 0;

const note = (n: number, isRead = false): Notification => ({
    id: `note-${n}`,
    title: `알림 ${n}`,
    body: `본문 ${n}`,
    createdAt: '2026-09-01T00:00:00Z',
    isRead,
    eventId: null,
    linkUrl: null,
});

const page = (items: Notification[], nextCursor: string | null, totalElements = items.length) => ({
    data: {
        success: true,
        code: 'SUCCESS',
        message: '성공했습니다.',
        data: { items, nextCursor, totalElements },
    },
});

const renderDrawer = (staleTime = 0) => {
    const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false, staleTime }, mutations: { retry: false } },
    });
    render(
        <QueryClientProvider client={queryClient}>
            <VirtualClockProvider>
                <MemoryRouter>
                    <NotificationDrawer />
                </MemoryRouter>
            </VirtualClockProvider>
        </QueryClientProvider>,
    );
};

const open = async () => {
    await userEvent.click(screen.getByRole('button', { name: '알림 전체 보기' }));
    return screen.findByRole('dialog');
};

describe('NotificationDrawer', () => {
    beforeEach(() => {
        // 사용자별로 목업 읽음 상태가 분리되므로 테스트마다 새 사용자로 시작한다
        apiClient.defaults.headers.common['X-User-ID'] = `drawer-${(userSeq += 1)}`;
    });
    afterEach(() => vi.restoreAllMocks());

    it('열면 알림 목록을 보여주고 삭제 버튼은 없다', async () => {
        renderDrawer();
        const dialog = await open();

        expect(await within(dialog).findByText('이벤트 시작 알림')).toBeInTheDocument();
        expect(within(dialog).getByText('읽지 않음 3개')).toBeInTheDocument();
        expect(within(dialog).queryByRole('button', { name: /삭제/ })).not.toBeInTheDocument();
    });

    it('재오픈하면 staleTime 안이어도 새 알림 목록을 조회한다', async () => {
        let version = 1;
        vi.spyOn(apiClient, 'get').mockImplementation(() =>
            Promise.resolve(page([note(version)], null)),
        );

        renderDrawer(60_000);
        let dialog = await open();
        expect(await within(dialog).findByText('알림 1')).toBeInTheDocument();

        await userEvent.click(within(dialog).getByRole('button', { name: '닫기' }));
        await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());

        version = 2;
        dialog = await open();
        expect(await within(dialog).findByText('알림 2')).toBeInTheDocument();
    });

    it('재조회가 실패해도 더보기를 누르기 전에는 더보기 오류를 보이지 않는다', async () => {
        const get = vi.spyOn(apiClient, 'get').mockResolvedValue(page([note(1)], 'cursor-1', 2));

        renderDrawer(60_000);
        let dialog = await open();
        await within(dialog).findByText('알림 1');
        await userEvent.click(within(dialog).getByRole('button', { name: '닫기' }));
        await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());

        get.mockRejectedValue(new Error('network'));
        dialog = await open();

        await within(dialog).findByText('알림 1');
        // 첫 오픈의 목록·미읽음 조회 2회 + 재오픈 목록 재조회 1회
        await waitFor(() => expect(get).toHaveBeenCalledTimes(3));
        expect(within(dialog).queryByText('알림을 더 불러오지 못했어요.')).not.toBeInTheDocument();
    });

    it('모두 읽음을 누르면 미읽음이 0이 된다', async () => {
        renderDrawer();
        const dialog = await open();
        await within(dialog).findByText('읽지 않음 3개');

        await userEvent.click(within(dialog).getByRole('button', { name: '모두 읽음' }));

        expect(await within(dialog).findByText('모두 읽었어요')).toBeInTheDocument();
        expect(within(dialog).getByRole('button', { name: '모두 읽음' })).toBeDisabled();
    });

    it('개별 알림을 누르면 읽음 처리되어 미읽음 수가 줄어든다', async () => {
        renderDrawer();
        const dialog = await open();
        await within(dialog).findByText('읽지 않음 3개');

        await userEvent.click(within(dialog).getByRole('button', { name: /당첨자 발표 안내/ }));

        expect(await within(dialog).findByText('읽지 않음 2개')).toBeInTheDocument();
    });

    it('목록이 비면 빈 상태를 보여준다', async () => {
        vi.spyOn(apiClient, 'get').mockResolvedValue(page([], null));
        renderDrawer();
        const dialog = await open();

        expect(await within(dialog).findByText('새 알림이 없어요')).toBeInTheDocument();
    });

    it('첫 조회가 실패하면 오류와 다시 시도를 보여준다', async () => {
        const get = vi.spyOn(apiClient, 'get').mockRejectedValue(new Error('network'));
        renderDrawer();
        const dialog = await open();

        expect(await within(dialog).findByRole('alert')).toHaveTextContent(
            '알림을 불러오지 못했어요.',
        );

        get.mockResolvedValue(page([note(1)], null));
        await userEvent.click(within(dialog).getByRole('button', { name: '다시 시도' }));

        expect(await within(dialog).findByText('알림 1')).toBeInTheDocument();
    });

    it('더 보기를 누르면 nextCursor로 다음 페이지를 이어 붙인다', async () => {
        const get = vi.spyOn(apiClient, 'get').mockImplementation((_url, config) => {
            const cursor = (config?.params as { cursor?: string } | undefined)?.cursor;
            return Promise.resolve(
                cursor === 'cursor-1' ? page([note(2)], null, 2) : page([note(1)], 'cursor-1', 2),
            );
        });
        renderDrawer();
        const dialog = await open();

        await userEvent.click(await within(dialog).findByRole('button', { name: '알림 더 보기' }));

        await waitFor(() => expect(within(dialog).getByText('알림 2')).toBeInTheDocument());
        expect(within(dialog).getByText('알림 1')).toBeInTheDocument();
        expect(within(dialog).queryByRole('button', { name: '알림 더 보기' })).toBeNull();
        // 서버가 준 nextCursor를 그대로 두 번째 요청에 실었는지 확인한다
        const cursors = get.mock.calls.map(
            ([, config]) => (config?.params as { cursor?: string } | undefined)?.cursor,
        );
        expect(cursors).toContain('cursor-1');
    });
});
