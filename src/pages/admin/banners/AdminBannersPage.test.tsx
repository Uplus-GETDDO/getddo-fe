import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import type * as bannerEntities from '@entities/banner';
import type * as eventEntities from '@entities/event';

import { apiClient } from '@shared/api/client';

import { AdminBannersPage } from './AdminBannersPage';

// jsdom에는 Radix Select가 키보드 탐색 시 사용하는 스크롤 API가 없다.
beforeAll(() => {
    Object.defineProperty(Element.prototype, 'scrollIntoView', {
        configurable: true,
        value: vi.fn(),
    });
});
afterAll(() => Reflect.deleteProperty(Element.prototype, 'scrollIntoView'));

const { banners } = vi.hoisted(() => ({
    banners: [10, 20].map<bannerEntities.AdminBanner>((displayOrder, index) => ({
        id: `legacy-${index}`,
        eventId: 'evt-001',
        imageKey: 'legacy.png',
        imageUrl: '/legacy.png',
        displayOrder,
        createdAt: '2026-10-01T00:00:00Z',
        updatedAt: '2026-10-01T00:00:00Z',
    })),
}));

vi.mock('@entities/banner', async (importOriginal) => ({
    ...(await importOriginal<typeof bannerEntities>()),
    useAdminBanners: () => ({ data: banners, isPending: false, isError: false }),
}));

vi.mock('@entities/event', async (importOriginal) => ({
    ...(await importOriginal<typeof eventEntities>()),
    useAdminEvents: () => ({
        data: { items: [{ id: 'evt-001', title: '연결 이벤트' }] },
        isPending: false,
        isError: false,
    }),
}));

function renderPage() {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
        <QueryClientProvider client={client}>
            <AdminBannersPage />
        </QueryClientProvider>,
    );
}

describe('이전 배너 관리', () => {
    it('미연결 이전 배너를 유지하고 수정에는 이벤트 선택을 요구한다', async () => {
        const first = banners[0]!;
        first.eventId = null;
        try {
            const user = userEvent.setup();
            renderPage();
            expect(screen.getByText('(미연결 배너)')).toBeInTheDocument();
            await user.click(screen.getByRole('button', { name: '(미연결 배너) 배너 수정' }));
            await user.click(screen.getByRole('button', { name: '수정' }));
            expect(await screen.findByText('연결할 이벤트를 선택하세요')).toBeInTheDocument();
            expect(screen.getByRole('dialog')).toBeInTheDocument();
        } finally {
            first.eventId = 'evt-001';
        }
    });

    it('비연속 순서 목록에서도 새 배너를 N+1 위치에 등록한다', async () => {
        const user = userEvent.setup();
        // 이미지 키는 이제 손으로 적지 않고 업로드가 받아 온다 — 같은 post를 두 번 쓴다
        const post = vi.spyOn(apiClient, 'post').mockImplementation((url: string) =>
            Promise.resolve({
                data: url.includes('/images')
                    ? {
                          success: true,
                          code: 'SUCCESS',
                          message: '',
                          data: { imageKey: 'new.png', imageUrl: 'https://cdn/new.png' },
                      }
                    : { success: true, code: 'SUCCESS', message: '', data: banners[0] },
            }),
        );
        try {
            renderPage();
            await user.click(screen.getByRole('button', { name: '배너 등록' }));
            screen.getByRole('combobox', { name: '연결 이벤트' }).focus();
            await user.keyboard('{ArrowDown}');
            await user.keyboard('{Enter}');
            await user.upload(
                screen.getByLabelText('배너 이미지'),
                new File(['x'], 'new.png', { type: 'image/png' }),
            );
            await waitFor(() => expect(screen.getByText('new.png')).toBeInTheDocument());
            await user.click(screen.getByRole('button', { name: '등록' }));
            await waitFor(() =>
                expect(post).toHaveBeenCalledWith('/v1/admin/banners', {
                    eventId: 'evt-001',
                    imageKey: 'new.png',
                    displayOrder: 3,
                }),
            );
        } finally {
            post.mockRestore();
        }
    });

    it('이전 배너 수정은 저장된 순서값 대신 목록 내 위치를 전송한다', async () => {
        const user = userEvent.setup();
        const put = vi.spyOn(apiClient, 'put').mockResolvedValue({
            data: { success: true, code: 'SUCCESS', message: '', data: banners[1] },
        });
        try {
            renderPage();
            await user.click(screen.getAllByRole('button', { name: '연결 이벤트 배너 수정' })[1]!);
            await user.click(screen.getByRole('button', { name: '수정' }));
            await waitFor(() =>
                expect(put).toHaveBeenCalledWith('/v1/admin/banners/legacy-1', {
                    eventId: 'evt-001',
                    imageKey: 'legacy.png',
                    displayOrder: 2,
                }),
            );
        } finally {
            put.mockRestore();
        }
    });
});
