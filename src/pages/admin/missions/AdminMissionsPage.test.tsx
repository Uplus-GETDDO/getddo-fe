import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { apiClient } from '@shared/api/client';

import { AdminMissionsPage } from './AdminMissionsPage';

afterEach(() => vi.restoreAllMocks());
describe('관리자 미션', () => {
    it('빈 목록과 등록 폼의 즉시 활성·1장 정책을 표시한다', async () => {
        vi.spyOn(apiClient, 'get').mockResolvedValue({
            data: { success: true, data: { items: [], page: 1, size: 20, totalElements: 0 } },
        });
        render(
            <QueryClientProvider client={new QueryClient()}>
                <AdminMissionsPage />
            </QueryClientProvider>,
        );
        expect(await screen.findByText('등록된 미션이 없습니다.')).toBeInTheDocument();
        await userEvent.click(screen.getByRole('button', { name: '미션 등록' }));
        expect(screen.getByRole('dialog')).toBeInTheDocument();
        expect(screen.getByText(/등록 즉시 ACTIVE/)).toBeInTheDocument();
        expect(screen.queryByText('DRAFT')).not.toBeInTheDocument();
    });
});
