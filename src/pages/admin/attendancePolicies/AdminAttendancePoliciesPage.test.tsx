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
const streakSet = (
    id: string,
    effectiveMonth: string,
    milestoneDays = 7,
    rewardTicketCount = 1,
) => ({
    id,
    effectiveMonth,
    milestones: [{ id: `${id}-m1`, milestoneDays, rewardTicketCount }],
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
    it('현재·예약 정책을 카드로 보이고 예약 카드에만 수정 버튼을 둔다', async () => {
        const past = new Date(Date.now() - 2 * DAY_MS).toISOString();
        const future = new Date(Date.now() + 2 * DAY_MS).toISOString();
        const k = kstNow();
        const currentMonth = kstMonthOf(k);
        const nextMonth = kstMonthOf(
            new Date(Date.UTC(k.getUTCFullYear(), k.getUTCMonth() + 1, 1)),
        );
        mockPolicyLists(
            [dailyPolicy('p-past', past, 3), dailyPolicy('p-future', future, 5)],
            [streakSet('s-cur', currentMonth, 7, 1), streakSet('s-next', nextMonth, 14, 2)],
        );
        mount();
        // 현재 카드 — 일일 보상 장수·적용 시작, 연속 마일스톤·기준월
        expect(await screen.findByText('브론즈 3장')).toBeInTheDocument();
        expect(screen.getByText('브론즈 5장')).toBeInTheDocument();
        expect(screen.getAllByText(/^적용 시작 .+ KST$/)).toHaveLength(2);
        expect(screen.getByText(`적용 기준월 ${currentMonth} (KST)`)).toBeInTheDocument();
        expect(screen.getByText(`적용 기준월 ${nextMonth} (KST)`)).toBeInTheDocument();
        expect(screen.getByText('7일 연속: 브론즈 1장')).toBeInTheDocument();
        expect(screen.getByText('14일 연속: 브론즈 2장')).toBeInTheDocument();
        // 작성자 — 현재·예약 카드마다 1개씩 총 4개 (ADR-028 — ID 대신 현재 이름)
        expect(screen.getAllByText('작성 관리자')).toHaveLength(4);
        // 현재 카드에는 수정 버튼이 없고 예약 카드에만 있다
        const currentCards = screen.getAllByRole('article', { name: '현재 정책' });
        expect(currentCards).toHaveLength(2);
        for (const card of currentCards) {
            expect(within(card).queryByRole('button', { name: '수정' })).not.toBeInTheDocument();
        }
        const scheduledCards = screen.getAllByRole('article', { name: '예약된 변경' });
        expect(scheduledCards).toHaveLength(2);
        for (const card of scheduledCards) {
            expect(within(card).getByRole('button', { name: '수정' })).toBeInTheDocument();
        }
        // 예약이 있으면 새 예약 폼은 렌더하지 않는다
        expect(screen.queryByRole('button', { name: '일일 정책 예약' })).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: '연속 정책 예약' })).not.toBeInTheDocument();
        // 수동 새로 조회 버튼은 각 섹션에 유지한다
        expect(screen.getByRole('button', { name: '일일 정책 새로 조회' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: '연속 정책 새로 조회' })).toBeInTheDocument();
        // 이력 목록·페이지네이션·총 건수는 없다
        expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
        expect(screen.queryByText(/^총 \d+건$/)).not.toBeInTheDocument();
        expect(screen.queryByText('등록된 정책이 없습니다.')).not.toBeInTheDocument();
    });
    it('현재·예약이 없으면 빈 카드 안내문과 예약 폼을 보인다', async () => {
        mockPolicyLists([], []);
        mount();
        expect((await screen.findAllByText('적용 중인 정책이 없습니다.')).length).toBe(2);
        expect(
            (
                await screen.findAllByText(
                    '예약된 변경이 없습니다. 예약하지 않으면 기존 정책이 유지됩니다.',
                )
            ).length,
        ).toBe(2);
        expect(screen.getByRole('button', { name: '일일 정책 예약' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: '연속 정책 예약' })).toBeInTheDocument();
    });
    it('중복 예약은 기존 예약 확인으로 안내한다', async () => {
        mockPolicyLists([], []);
        const post = vi
            .spyOn(apiClient, 'post')
            .mockRejectedValue(new ApiError('ATTENDANCE-004', '예약 중복', 409));
        mount();
        await userEvent.click(await screen.findByRole('button', { name: '일일 정책 예약' }));
        expect(await screen.findByText(/이미 예약된 정책/)).toBeInTheDocument();
        expect(post.mock.calls[0]?.[1]).toEqual({ rewardTicketCount: 1 });
    });
    it('예약 수정 버튼이 수정 다이얼로그를 열고 PUT으로 저장한다', async () => {
        const future = new Date(Date.now() + 2 * DAY_MS).toISOString();
        mockPolicyLists([dailyPolicy('p-future', future)], []);
        const put = vi.spyOn(apiClient, 'put').mockResolvedValue({
            data: { success: true, data: dailyPolicy('p-future', future, 5) },
        });
        mount();
        await userEvent.click(await screen.findByRole('button', { name: '수정' }));
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
    it('이미 시작한 예약은 서버 409를 안내 문구로 바꾼다', async () => {
        const future = new Date(Date.now() + 2 * DAY_MS).toISOString();
        mockPolicyLists([dailyPolicy('p-future', future)], []);
        vi.spyOn(apiClient, 'put').mockRejectedValue(
            new ApiError('ATTENDANCE-007', '이미 시작', 409),
        );
        mount();
        await userEvent.click(await screen.findByRole('button', { name: '수정' }));
        await userEvent.click(await screen.findByRole('button', { name: '정책 수정' }));
        expect(
            await screen.findByText(/이미 적용이 시작된 정책입니다\. 목록을 새로고침해 주세요/),
        ).toBeInTheDocument();
    });
    it('조회 실패 시 오류와 다시 시도만 보이고 카드·폼·새로 조회는 숨긴다', async () => {
        const get = vi
            .spyOn(apiClient, 'get')
            .mockRejectedValue(new ApiError('ATTENDANCE-002', '관리자 권한이 필요합니다.', 403));
        mount();
        expect((await screen.findAllByRole('alert')).length).toBeGreaterThanOrEqual(2);
        expect((await screen.findAllByText(/관리자 권한이 필요합니다/)).length).toBeGreaterThan(0);
        expect(screen.queryByText('현재 정책')).not.toBeInTheDocument();
        expect(screen.queryByText('예약된 변경')).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: '일일 정책 예약' })).not.toBeInTheDocument();
        expect(
            screen.queryByRole('button', { name: '일일 정책 새로 조회' }),
        ).not.toBeInTheDocument();
        // 다시 시도로 재조회한다 — 두 섹션 조회 + 재시도 1회
        await userEvent.click(screen.getAllByRole('button', { name: '다시 시도' })[0]!);
        await vi.waitFor(() => expect(get).toHaveBeenCalledTimes(3));
    });
    it('조회 중에는 스켈레톤만 보이고 카드·폼은 숨긴다', async () => {
        vi.spyOn(apiClient, 'get').mockImplementation(() => new Promise<never>(() => {}));
        mount();
        expect((await screen.findAllByRole('status')).length).toBeGreaterThanOrEqual(2);
        expect(screen.queryByText('현재 정책')).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: '일일 정책 예약' })).not.toBeInTheDocument();
    });
});
