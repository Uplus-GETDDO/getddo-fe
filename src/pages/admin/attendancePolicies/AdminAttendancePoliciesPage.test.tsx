import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ApiError, apiClient } from '@shared/api/client';
import { VirtualClockProvider } from '@shared/model/virtualClock';

import { AdminAttendancePoliciesPage } from './AdminAttendancePoliciesPage';

afterEach(() => vi.restoreAllMocks());
const mount = () =>
    render(
        <QueryClientProvider
            client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
        >
            <VirtualClockProvider>
                <AdminAttendancePoliciesPage />
            </VirtualClockProvider>
        </QueryClientProvider>,
    );

const DAY_MS = 86_400_000;
const kstNow = () => new Date(Date.now() + 9 * 3_600_000);
const kstMonthOf = (d: Date) =>
    `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;

const dailyPolicy = (id: string, effectiveFrom: string, rewardTicketCount = 2) => ({
    id,
    rewardTicketCount,
    effectiveFrom,
    effectiveUntil: null,
    createdBy: 'admin',
    createdByName: '관리자',
    createdAt: '2026-01-01T00:00:00Z',
});
const streakSet = (id: string, effectiveMonth: string) => ({
    id,
    effectiveMonth,
    milestones: [{ id: `${id}-m1`, milestoneDays: 7, rewardTicketCount: 1 }],
    createdBy: 'admin',
    createdByName: '관리자',
    createdAt: '2026-01-01T00:00:00Z',
});
const pageOf = (items: unknown[]) => ({
    data: { success: true, data: { items, page: 1, size: 20, totalElements: items.length } },
});
const mockPolicyLists = (dailyItems: unknown[], streakItems: unknown[]) =>
    vi.spyOn(apiClient, 'get').mockImplementation((url: string) => {
        if (url === '/v1/admin/policies/attendance/daily') {
            return Promise.resolve(pageOf(dailyItems));
        }
        if (url === '/v1/admin/policies/attendance/streak') {
            return Promise.resolve(pageOf(streakItems));
        }
        return Promise.reject(new Error(`unexpected ${url}`));
    });

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
    it('아직 시작하지 않은 정책에만 수정 버튼을 보이고 PUT으로 수정한다', async () => {
        const future = new Date(Date.now() + 2 * DAY_MS).toISOString();
        const past = new Date(Date.now() - 2 * DAY_MS).toISOString();
        const k = kstNow();
        const currentMonth = kstMonthOf(k);
        const nextMonth = kstMonthOf(
            new Date(Date.UTC(k.getUTCFullYear(), k.getUTCMonth() + 1, 1)),
        );
        mockPolicyLists(
            [dailyPolicy('p-future', future, 2), dailyPolicy('p-past', past, 3)],
            [streakSet('s-next', nextMonth), streakSet('s-cur', currentMonth)],
        );
        const put = vi.spyOn(apiClient, 'put').mockResolvedValue({
            data: { success: true, data: dailyPolicy('p-future', future, 5) },
        });
        mount();
        // ADR-028 — 작성자는 ID 대신 현재 이름으로 보인다
        expect((await screen.findAllByText('작성 관리자')).length).toBe(4);
        // 시작 전인 일일 1건·다음 달 연속 1건에만 수정 버튼
        const editButtons = await screen.findAllByRole('button', { name: '수정' });
        expect(editButtons).toHaveLength(2);
        await userEvent.click(editButtons[0]!);
        const dialog = await screen.findByRole('dialog');
        const countInput = within(dialog).getByLabelText('일일 보상 장수');
        await userEvent.clear(countInput);
        await userEvent.type(countInput, '5');
        await userEvent.click(within(dialog).getByRole('button', { name: '정책 수정' }));
        await vi.waitFor(() =>
            expect(put).toHaveBeenCalledWith('/v1/admin/policies/attendance/daily/p-future', {
                rewardTicketCount: 5,
            }),
        );
    });
    it('이미 시작한 정책은 서버 409를 안내 문구로 바꾼다', async () => {
        const future = new Date(Date.now() + 2 * DAY_MS).toISOString();
        mockPolicyLists([dailyPolicy('p-future', future)], []);
        vi.spyOn(apiClient, 'put').mockRejectedValue(
            new ApiError('ATTENDANCE-007', '이미 시작', 409),
        );
        mount();
        await userEvent.click(await screen.findByRole('button', { name: '수정' }));
        await userEvent.click(await screen.findByRole('button', { name: '정책 수정' }));
        expect(
            await screen.findByText(/이미 적용이 시작된 정책이라 수정할 수 없습니다/),
        ).toBeInTheDocument();
    });
});
