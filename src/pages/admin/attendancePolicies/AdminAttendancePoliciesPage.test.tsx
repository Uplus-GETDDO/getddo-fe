import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ApiError, apiClient } from '@shared/api/client';

import { AdminAttendancePoliciesPage } from './AdminAttendancePoliciesPage';

afterEach(() => vi.restoreAllMocks());
const mount = () =>
    render(
        <QueryClientProvider
            client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
        >
            <AdminAttendancePoliciesPage />
        </QueryClientProvider>,
    );

describe('관리자 출석 정책', () => {
    it('빈 목록을 표시하고 중복 예약은 기존 예약 확인으로 안내한다', async () => {
        vi.spyOn(apiClient, 'get').mockResolvedValue({
            data: { success: true, data: { items: [], page: 1, size: 20, totalElements: 0 } },
        });
        const post = vi
            .spyOn(apiClient, 'post')
            .mockRejectedValue(new ApiError('ATTENDANCE-004', '예약 중복', 409));
        mount();
        expect((await screen.findAllByText('등록된 정책이 없습니다.')).length).toBe(2);
        await userEvent.click(screen.getByRole('button', { name: '일일 정책 예약' }));
        expect(await screen.findByText(/이미 예약된 정책/)).toBeInTheDocument();
        expect(post.mock.calls[0]?.[1]).toEqual({ rewardTicketCount: 1 });
    });
    it('권한 거절을 빈 목록으로 표시하지 않는다', async () => {
        vi.spyOn(apiClient, 'get').mockRejectedValue(
            new ApiError('ATTENDANCE-002', '관리자 권한이 필요합니다.', 403),
        );
        mount();
        expect((await screen.findAllByText(/관리자 권한이 필요합니다/)).length).toBeGreaterThan(0);
        expect(screen.queryByText('등록된 정책이 없습니다.')).not.toBeInTheDocument();
    });
});
