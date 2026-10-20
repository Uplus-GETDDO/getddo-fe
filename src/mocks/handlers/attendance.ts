import { http } from 'msw';

import type { AttendanceMilestone, AttendanceReceipt, RewardReceipt } from '@entities/attendance';

import { env } from '@shared/config/env';
import { kstNextMonthStart } from '@shared/utils/date';

import { mockNow } from '../now';
import { fail, ok } from './response';
import { recordMockTicketGrant } from './ticket';

const api = (path: string) => `${env.apiBaseUrl}${path}`;

const DAY_MS = 24 * 60 * 60 * 1000;
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

// 출석 기준일은 00:00 KST에 바뀐다 — KST 날짜 문자열로 관리한다 (getddo-spec 공통 시간 기준)
const toDate = (date: Date) => new Date(date.getTime() + KST_OFFSET_MS).toISOString().slice(0, 10);
// 가상 시계 기준 — 시간 여행 시연에서 '오늘' 출석이 가상 날짜를 따라간다
const daysAgo = (days: number) => toDate(new Date(mockNow().getTime() - days * DAY_MS));

// KST 날짜 문자열(YYYY-MM-DD)의 전날 — 날짜끼리만 다루므로 UTC 자정 기준으로 하루를 뺀다
const prevDate = (date: string) => {
    const d = new Date(`${date}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() - 1);
    return d.toISOString().slice(0, 10);
};

// 다음 출석 기준일이 시작되는 시각(다음 KST 자정) — AT01 nextResetAt
const nextKstMidnight = (now: Date) => {
    const k = new Date(now.getTime() + KST_OFFSET_MS);
    return new Date(
        Date.UTC(k.getUTCFullYear(), k.getUTCMonth(), k.getUTCDate() + 1) - KST_OFFSET_MS,
    ).toISOString();
};

interface AttendanceState {
    /** 출석 기준일(KST YYYY-MM-DD) 목록 */
    checkedDates: string[];
    /** 월(YYYY-MM) → milestoneDays → 지급 시각 — 같은 단계 보상은 그 달에 한 번만 지급한다 */
    claimedMilestones: Map<string, Map<number, string>>;
    /** 기준일별 확정 영수증 — 같은 기준일 재요청에 그대로 돌려준다 (AT02 명시) */
    receiptsByDate: Map<string, AttendanceReceipt>;
}

const seedCheckedDates = () => [daysAgo(5), daysAgo(3), daysAgo(2), daysAgo(1)];

/** 시연용 시드 날짜의 합성 영수증 — 같은 날짜에 다시 출석하면 보상을 중복 지급하지 않는다 */
const seedReceiptFor = (date: string): AttendanceReceipt => {
    const createdAt = new Date(`${date}T09:00:00+09:00`).toISOString();
    const expiresAt = kstNextMonthStart(new Date(`${date}T00:00:00+09:00`)).toISOString();
    return {
        attendanceId: crypto.randomUUID(),
        attendanceDate: date,
        consecutiveDays: 1,
        rewards: [
            {
                claimId: crypto.randomUUID(),
                rewardType: 'DAILY',
                milestoneDays: null,
                ticketCount: policy.dailyRewardTickets,
                grantedAt: createdAt,
                expiresAt,
            },
        ],
        createdAt,
    };
};

// 시연용 초기 상태 — 어제까지 3일 연속 출석(중간에 하루 빠진 이력 포함)으로 시작한다
const seedState = (): AttendanceState => {
    const checkedDates = seedCheckedDates();
    const receiptsByDate = new Map<string, AttendanceReceipt>();
    for (const date of checkedDates) {
        receiptsByDate.set(date, seedReceiptFor(date));
    }
    return {
        checkedDates,
        claimedMilestones: new Map(),
        receiptsByDate,
    };
};

// X-User-ID별로 분리한다 — 한 사용자의 출석이 다른 사용자에게 보이거나 보상을 막지 않도록
const stateByUser = new Map<string, AttendanceState>();

const userIdOf = (request: Request) => request.headers.get('X-User-ID') ?? 'anonymous';

const stateFor = (userId: string) => {
    let state = stateByUser.get(userId);
    if (!state) {
        state = seedState();
        stateByUser.set(userId, state);
    }
    return state;
};

// getddo-spec 출석 규칙의 초기 설정 — 관리자 정책 API(AP01~AP04)가 오면 저장소가 된다
const policy = {
    dailyRewardTickets: 1,
    streakBonuses: [
        { days: 7, rewardTickets: 1 },
        { days: 14, rewardTickets: 3 },
        { days: 28, rewardTickets: 7 },
    ],
};

// endDate를 끝으로 같은 달 안에서 이어지는 출석 일수 — 연속 출석은 매월 초기화되므로 월 경계에서 끊긴다
const streakEndingAt = (dates: ReadonlySet<string>, endDate: string) => {
    const month = endDate.slice(0, 7);
    let count = 0;
    for (
        let cursor = endDate;
        cursor.startsWith(month) && dates.has(cursor);
        cursor = prevDate(cursor)
    ) {
        count += 1;
    }
    return count;
};

// AT01 consecutiveDays — 오늘 출석했으면 오늘까지, 아니면 어제(같은 달)까지 이어지는 일수.
// 어제가 지난달이거나 출석이 없으면 0이다 (spec AT01·AT03 계산 규칙)
const currentStreak = (dates: ReadonlySet<string>, today: string) => {
    if (dates.has(today)) return streakEndingAt(dates, today);
    const yesterday = prevDate(today);
    return yesterday.startsWith(today.slice(0, 7)) && dates.has(yesterday)
        ? streakEndingAt(dates, yesterday)
        : 0;
};

// 그 달에 적용되는 단계 묶음에 claimed를 붙인다 — mock은 단일 묶음이라 달마다 같은 단계다
const milestonesFor = (state: AttendanceState, month: string): AttendanceMilestone[] =>
    policy.streakBonuses.map((bonus) => {
        const claimedAt = state.claimedMilestones.get(month)?.get(bonus.days) ?? null;
        return {
            milestoneDays: bonus.days,
            rewardTicketCount: bonus.rewardTickets,
            claimed: claimedAt !== null,
            claimedAt,
        };
    });

export const attendanceHandlers = [
    // AT01 초안 — 오늘 출석 여부·연속 일수·일일 보상량·이번 달 단계·다음 초기화 시각
    http.get(api('/v1/attendances/today'), ({ request }) => {
        const now = mockNow();
        const today = toDate(now);
        const state = stateFor(userIdOf(request));
        const dates = new Set(state.checkedDates);
        return ok({
            attendanceDate: today,
            attended: dates.has(today),
            consecutiveDays: currentStreak(dates, today),
            dailyRewardTicketCount: policy.dailyRewardTickets,
            milestones: milestonesFor(state, today.slice(0, 7)),
            nextResetAt: nextKstMidnight(now),
            serverTime: now.toISOString(),
        });
    }),
    // AT02 초안 — 본문을 받지 않는다. 날짜·보상량은 서버 KST 기준일·정책으로 정한다
    http.post(api('/v1/attendances'), async ({ request }) => {
        // 본문이 붙어 오는 경우도 있으므로 소비해 두고, 출석 판정에는 쓰지 않는다
        await request.json().catch(() => null);

        const userId = userIdOf(request);
        const state = stateFor(userId);
        const now = mockNow();
        const today = toDate(now);
        const month = today.slice(0, 7);
        const dates = new Set(state.checkedDates);

        // 같은 기준일 재요청: 새로 지급하지 않고 이미 확정한 영수증을 그대로 돌려준다 (AT02 명시)
        const existingReceipt = state.receiptsByDate.get(today);
        if (existingReceipt) {
            return ok(existingReceipt, 200);
        }

        state.checkedDates.push(today);
        const yesterday = prevDate(today);
        const consecutiveDays =
            (yesterday.startsWith(month) ? streakEndingAt(dates, yesterday) : 0) + 1;

        const nowIso = now.toISOString();
        // 응모권은 다음 달 1일 00:00 KST에 만료한다 (getddo-spec ticket.md 월 만료 정책)
        const expiresAt = kstNextMonthStart(now).toISOString();
        const rewards: RewardReceipt[] = [
            {
                claimId: crypto.randomUUID(),
                rewardType: 'DAILY',
                milestoneDays: null,
                ticketCount: policy.dailyRewardTickets,
                grantedAt: nowIso,
                expiresAt,
            },
        ];

        // 연속 단계 도달 시 STREAK 보상 — 같은 달 같은 단계는 한 번만 지급한다
        const bonus = policy.streakBonuses.find((b) => b.days === consecutiveDays);
        if (bonus && !state.claimedMilestones.get(month)?.has(bonus.days)) {
            let claimed = state.claimedMilestones.get(month);
            if (!claimed) {
                claimed = new Map();
                state.claimedMilestones.set(month, claimed);
            }
            claimed.set(bonus.days, nowIso);
            rewards.push({
                claimId: crypto.randomUUID(),
                rewardType: 'STREAK',
                milestoneDays: bonus.days,
                ticketCount: bonus.rewardTickets,
                grantedAt: nowIso,
                expiresAt,
            });
        }

        const receipt: AttendanceReceipt = {
            attendanceId: crypto.randomUUID(),
            attendanceDate: today,
            consecutiveDays,
            rewards,
            createdAt: nowIso,
        };
        state.receiptsByDate.set(today, receipt);

        const total = rewards.reduce((sum, reward) => sum + reward.ticketCount, 0);
        // 출석 보상은 브론즈 고정이다 (ADR-016) — 지급 장수만큼 장 단위 이력을 남긴다
        if (total > 0) {
            recordMockTicketGrant(userId, total, '매일 출석체크 리워드', {
                grade: 'BRONZE',
                expiresAt,
                attendanceDate: today,
            });
        }

        return ok(receipt, 201);
    }),
    // AT03 초안 — month는 필수 'YYYY-MM'. 기록 없는 달·미래 달은 오류가 아니라 빈 목록이다
    http.get(api('/v1/attendances'), ({ request }) => {
        const month = new URL(request.url).searchParams.get('month');
        if (!month || !MONTH_PATTERN.test(month)) {
            return fail(400, 'COMMON-002', 'month는 YYYY-MM 형식이어야 합니다');
        }
        const state = stateFor(userIdOf(request));
        return ok({
            month,
            attendanceDates: state.checkedDates.filter((date) => date.startsWith(month)).sort(),
            milestones: milestonesFor(state, month),
            serverTime: mockNow().toISOString(),
        });
    }),
];
