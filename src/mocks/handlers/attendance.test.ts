import { afterEach, describe, expect, it, vi } from 'vitest';

import { apiClient } from '@shared/api/client';

interface RewardReceipt {
    claimId: string;
    rewardType: 'DAILY' | 'STREAK';
    milestoneDays: number | null;
    ticketCount: number;
    grantedAt: string | null;
    expiresAt: string | null;
}

interface AttendanceReceipt {
    attendanceId: string;
    attendanceDate: string;
    consecutiveDays: number;
    rewards: RewardReceipt[];
    createdAt: string;
}

interface AttendanceToday {
    attendanceDate: string;
    attended: boolean;
    consecutiveDays: number;
    dailyRewardTicketCount: number;
    milestones: {
        milestoneDays: number;
        rewardTicketCount: number;
        claimed: boolean;
        claimedAt: string | null;
    }[];
    nextResetAt: string;
    serverTime: string;
}

const headers = (userId: string) => ({ 'X-User-ID': userId });
const uniqueUser = () => `user-att-${crypto.randomUUID()}`;

const check = (userId: string) =>
    apiClient.post<{ data: AttendanceReceipt }>('/v1/attendances', undefined, {
        headers: headers(userId),
        validateStatus: () => true,
    });

const today = (userId: string) =>
    apiClient.get<{ data: AttendanceToday }>('/v1/attendances/today', {
        headers: headers(userId),
    });

const month = (userId: string, value?: string) =>
    apiClient.get<{ data: { month: string; attendanceDates: string[] } }>('/v1/attendances', {
        headers: headers(userId),
        params: value === undefined ? {} : { month: value },
        validateStatus: () => true,
    });

// 두 요청 사이에 KST 자정이 지나면 결과가 달라지므로 Date만 고정한다 — 타이머까지 가짜로 바꾸면 MSW 요청이 멈춘다
const freezeDate = (iso: string) => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(iso));
};

// KST 자정(전날 UTC 15:00)에서 충분히 멀리 둔 시각 — 해당 UTC 날짜의 21:00 KST
const freezeAt = (utcDate: string) => freezeDate(`${utcDate}T12:00:00Z`);

afterEach(() => {
    vi.useRealTimers();
});

describe('출석 목업 핸들러', () => {
    it.each([
        ['2026-10-20', '2026-10-21'],
        ['2026-10-31', '2026-11-01'],
    ])('%s KST 자정에 기준일과 다음 초기화 시각이 바뀐다', async (day, nextDay) => {
        const userId = uniqueUser();
        freezeDate(`${day}T14:59:59Z`);
        await check(userId);
        expect((await today(userId)).data.data).toMatchObject({
            attendanceDate: day,
            attended: true,
            nextResetAt: `${day}T15:00:00.000Z`,
        });
        expect((await check(userId)).status).toBe(200);

        freezeDate(`${day}T15:00:00Z`);
        const status = (await today(userId)).data.data;
        expect(status).toMatchObject({
            attendanceDate: nextDay,
            attended: false,
            nextResetAt: `${nextDay}T15:00:00.000Z`,
        });
        if (nextDay.endsWith('-01')) expect(status.consecutiveDays).toBe(0);
        expect((await check(userId)).status).toBe(201);
        expect((await check(userId)).status).toBe(200);
    });

    it('첫 출석은 DAILY 보상을 담은 영수증을 201로 돌려준다', async () => {
        freezeAt('2026-10-20');
        const userId = uniqueUser();

        const res = await check(userId);
        expect(res.status).toBe(201);
        const receipt = res.data.data;
        expect(receipt.attendanceDate).toBe('2026-10-20');
        // 시드는 어제까지 3일 연속 — 오늘은 4일째
        expect(receipt.consecutiveDays).toBe(4);
        expect(receipt.rewards).toEqual([
            expect.objectContaining({
                rewardType: 'DAILY',
                milestoneDays: null,
                ticketCount: 1,
            }),
        ]);
    });

    it('같은 날 재요청은 새로 지급하지 않고 처음 영수증을 200으로 돌려준다', async () => {
        freezeAt('2026-10-20');
        const userId = uniqueUser();

        const first = await check(userId);
        const again = await check(userId);
        expect(again.status).toBe(200);
        expect(again.data).toEqual(first.data);
    });

    it('기준일을 되돌려도 이미 지급한 날짜의 영수증을 그대로 반환하고 보상을 다시 지급하지 않는다', async () => {
        const userId = uniqueUser();
        freezeAt('2026-10-20');
        const first = await check(userId);

        freezeAt('2026-10-21');
        await check(userId);

        freezeAt('2026-10-20');
        const again = await check(userId);
        expect(again.status).toBe(200);
        expect(again.data).toEqual(first.data);
    });

    it('시드 날짜에 다시 출석하면 보상을 다시 지급하지 않는다', async () => {
        const userId = uniqueUser();
        // 10-21 기준으로 시드 생성 — checkedDates에 10-20(어제)가 포함된다
        freezeAt('2026-10-21');
        await today(userId);

        freezeAt('2026-10-20');
        const res = await check(userId);
        expect(res.status).toBe(200);
        expect(res.data.data.rewards).toEqual([
            expect.objectContaining({ rewardType: 'DAILY', ticketCount: 1 }),
        ]);
    });

    it('연속 단계에 도달하면 STREAK 보상을 붙이고 그 달에는 한 번만 지급한다', async () => {
        const userId = uniqueUser();
        // 시드 3일에서 시작해 4·5·6·7일째를 채운다 — 7일째에 첫 단계 보상
        const days = ['2026-10-05', '2026-10-06', '2026-10-07', '2026-10-08'];
        let last: Awaited<ReturnType<typeof check>> | null = null;
        for (const day of days) {
            freezeAt(day);
            last = await check(userId);
        }

        expect(last?.status).toBe(201);
        expect(last?.data.data.consecutiveDays).toBe(7);
        expect(last?.data.data.rewards).toEqual(
            expect.arrayContaining([
                expect.objectContaining({ rewardType: 'DAILY', ticketCount: 1 }),
                expect.objectContaining({
                    rewardType: 'STREAK',
                    milestoneDays: 7,
                    ticketCount: 1,
                }),
            ]),
        );

        const status = await today(userId);
        expect(status.data.data.consecutiveDays).toBe(7);
        expect(status.data.data.milestones).toEqual(
            expect.arrayContaining([
                expect.objectContaining({ milestoneDays: 7, claimed: true }),
                expect.objectContaining({ milestoneDays: 14, claimed: false }),
            ]),
        );
    });

    it('AT01은 출석 기준일·일일 보상량·다음 초기화 시각을 준다', async () => {
        freezeAt('2026-10-20');
        const userId = uniqueUser();

        const { data } = await today(userId);
        const status = data.data;
        expect(status.attendanceDate).toBe('2026-10-20');
        expect(status.attended).toBe(false);
        // 어제까지 3일 연속 시드
        expect(status.consecutiveDays).toBe(3);
        expect(status.dailyRewardTicketCount).toBe(1);
        expect(status.nextResetAt > status.serverTime).toBe(true);
    });

    it('AT03은 month가 없거나 형식이 아니면 400, 맞으면 그 달 출석일을 준다', async () => {
        freezeAt('2026-10-20');
        const userId = uniqueUser();

        expect((await month(userId)).status).toBe(400);
        expect((await month(userId, '2026-1')).status).toBe(400);
        expect((await month(userId, '2026-13')).status).toBe(400);

        await check(userId);
        const { status, data } = await month(userId, '2026-10');
        expect(status).toBe(200);
        expect(data.data.attendanceDates).toContain('2026-10-20');

        // 기록이 없는 달은 오류가 아니라 빈 목록이다
        const empty = await month(userId, '2026-09');
        expect(empty.status).toBe(200);
        expect(empty.data.data.attendanceDates).toEqual([]);
    });

    it('출석 상태와 응모권 잔액은 사용자별로 분리된다', async () => {
        freezeAt('2026-10-20');
        const userA = uniqueUser();
        const userB = uniqueUser();

        const { data: beforeB } = await apiClient.get<{
            data: { availableCount: number };
        }>('/v1/tickets/me', { headers: headers(userB) });

        const first = await check(userA);
        expect(first.status).toBe(201);

        // A의 출석 보상이 B의 보유량을 바꾸지 않는다
        const { data: afterB } = await apiClient.get<{
            data: { availableCount: number };
        }>('/v1/tickets/me', { headers: headers(userB) });
        expect(afterB.data.availableCount).toBe(beforeB.data.availableCount);

        // B도 첫 출석으로 새 보상을 받는다 — A의 출석이 B를 막지 않는다
        const second = await check(userB);
        expect(second.status).toBe(201);
        const { data: afterA } = await apiClient.get<{
            data: { availableCount: number };
        }>('/v1/tickets/me', { headers: headers(userA) });
        expect(afterA.data.availableCount).toBe(beforeB.data.availableCount + 1);
    });
});
