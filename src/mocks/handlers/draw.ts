import { http } from 'msw';
import { z } from 'zod';

import type {
    CancellationSummary,
    DrawCandidate,
    DrawExecutionAudit,
    DrawExecutionResponse,
    DrawFailure,
    DrawResult,
    DrawResultConfirmation,
    DrawRun,
    DrawRunDetail,
    DrawVerification,
} from '@entities/drawResult';
import type { PublicationUpdateResult, PublicListChange } from '@entities/winner';

import { awardCancellationRequestSchema } from '@entities/winner';
import { env } from '@shared/config/env';
import { IDEMPOTENCY_HEADER } from '@shared/utils/idempotencyKey';

import { mockNow } from '../now';
import { mockEvents } from './event';
import { fail, ok } from './response';
import { findMockVirtualUser } from './virtualUsers';

const api = (path: string) => `${env.apiBaseUrl}${path}`;

/*
 * 추첨 관리 목업 — getddo-spec 05-api/drawing.md AD01~AD09 (검토 대기 초안).
 *
 * 이벤트별 추첨 상태(store)를 처음 조회할 때 만들고, 시연 루프
 * 응모 → 최초 추첨(확정) → 발표 → 당첨 취소 → 재추첨 → 공개 명단 반영 → 변경 이력을 끝까지 돌린다.
 * 재추첨 실행은 서버가 비동기로 선정하는 것처럼 시간이 지나며 PREPARING → RUNNING → CONFIRMED로 진행한다.
 */

const MINUTE = 60 * 1000;
/** ADR-026 — 최초 자동 추첨은 마감 + 1분부터 대상이 된다. 공개 예정 시각이 아니다 */
const DRAW_DELAY_MS = 1 * MINUTE;
/** 이벤트당 후보 명단 규모 */
const CANDIDATE_COUNT = 33;
/** 재추첨 실행이 준비 → 선정 → 확정으로 넘어가는 경과 시간 (실제 시계 기준, 가상 시계와 무관) */
const PREPARING_MS = 1500;
const CONFIRM_MS = 4500;
/** 한 이벤트에서 목업이 만드는 슬롯 상한 — 당첨 인원이 큰 시드도 화면에 다 담기게 한다 */
const SLOT_LIMIT = 50;
const GRADE_WEIGHT = { bronze: 1, silver: 3, gold: 5 } as const;
const DEFAULT_ACTOR = 'vu-admin';

interface MockPrize {
    id: string;
    rank: number;
    winnerCount: number;
}

/** 관리자 목업(adminEvent.ts)에만 있는 시드 이벤트 — 시연용 운영 상태를 추첨 쪽에서도 재현한다 */
const EXTRA_EVENTS: Record<
    string,
    { endsAtOffsetMin: number; prizes: MockPrize[]; canceled?: boolean; published?: boolean }
> = {
    // 취소된 이벤트 — AD06·AD05의 이벤트 취소 409 시연용
    '20000000-0000-4000-8000-000000000902': {
        endsAtOffsetMin: -24 * 60,
        canceled: true,
        prizes: [{ id: '20000000-0000-4000-8000-000000000902-p1', rank: 1, winnerCount: 30 }],
    },
    // 재추첨이 실패해 재개를 기다리는 이벤트
    '20000000-0000-4000-8000-000000000904': {
        endsAtOffsetMin: -30,
        prizes: [{ id: '20000000-0000-4000-8000-000000000904-p1', rank: 1, winnerCount: 1 }],
    },
    // 추첨은 확정됐지만 최초 발표 전인 이벤트 — 최초 공개 전 재추첨 확인(정책 미확정) 시연용
    '20000000-0000-4000-8000-000000000905': {
        endsAtOffsetMin: -20,
        prizes: [{ id: '20000000-0000-4000-8000-000000000905-p1', rank: 1, winnerCount: 3 }],
    },
    // 최초 추첨이 실패해 재개를 기다리는 이벤트 — POST /admin/draws/{runId}/resume 시연용 (GD-87)
    '20000000-0000-4000-8000-000000000906': {
        endsAtOffsetMin: -20,
        prizes: [{ id: '20000000-0000-4000-8000-000000000906-p1', rank: 1, winnerCount: 3 }],
    },
};
const FAILED_INITIAL_EVENT = '20000000-0000-4000-8000-000000000906';

interface MockRun {
    detail: DrawRunDetail;
    /** AD03 후보 스냅샷의 candidate id — 실행 생성 시점에 고정한다 */
    candidateIds: string[];
    /** 비동기 진행의 기준 시각(Date.now) — null이면 진행하지 않는다 */
    progressFrom: number | null;
    /** 재추첨이 채울 빈 슬롯 */
    vacancy: { prizeId: string; prizeRank: number; slotNumber: number } | null;
    appliedPublication: PublicationUpdateResult | null;
}

interface StoredCancellation {
    key: string;
    /** 취소된 결과 ID — AD05 응답의 canceledDrawResultId, 요약의 resultId */
    resultId: string;
    reason: string;
    cancellationId: string;
    canceledBy: string;
    canceledAt: string;
    /** 이 취소에 연결된 재추첨 실행 ID — 취소 원본 실행 ID와 다르다 */
    replacementRunId: string;
}

/** DrawExecutionAudit에는 runId가 없다 — 조회 경로의 실행과 묶으려고 목업에서만 부여한다 */
interface MockAudit extends DrawExecutionAudit {
    runId: string;
}

interface DrawStore {
    eventId: string;
    prizes: MockPrize[];
    candidates: DrawCandidate[];
    runs: MockRun[];
    canceled: boolean;
    firstPublished: boolean;
    /** 최초 공개가 성공한 시각 — 미공개면 null */
    publishedAt: string | null;
    /** `${prizeId}:${slotNumber}` → 공개 명단의 사용자 */
    publicList: Map<string, string | null>;
    revision: number;
    changes: PublicListChange[];
    verifications: DrawVerification[];
    cancellations: StoredCancellation[];
    failures: DrawFailure[];
    audits: MockAudit[];
    /** GD-199 최초 발표 결과 — 같은 runId의 재요청은 이 결과를 돌려준다 */
    initialConfirmation: DrawResultConfirmation | null;
}

const stores = new Map<string, DrawStore>();

/* ── 결정적 난수 — 같은 이벤트·실행은 항상 같은 결과를 낸다 ── */

function hashString(value: string): number {
    let h = 2166136261;
    for (let i = 0; i < value.length; i += 1) {
        h ^= value.charCodeAt(i);
        h = Math.imul(h, 16777619);
    }
    return h >>> 0;
}

function seededRandom(seed: string): () => number {
    let a = hashString(seed);
    return () => {
        a = (a + 0x6d2b79f5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

function pickWeighted(pool: DrawCandidate[], random: () => number): DrawCandidate {
    const total = pool.reduce((sum, c) => sum + c.weight, 0);
    let cursor = random() * total;
    for (const candidate of pool) {
        cursor -= candidate.weight;
        if (cursor < 0) return candidate;
    }
    return pool[pool.length - 1]!;
}

/* ── 식별자 — 경로에서 이벤트를 되찾을 수 있게 이벤트 ID를 포함한다 ── */

const runIdOf = (eventId: string, runNumber: number) => `drw-${eventId}-r${runNumber}`;
const resultIdOf = (eventId: string, runNumber: number, slotNumber: number) =>
    `drr-${eventId}-r${runNumber}-s${slotNumber}`;
const cancellationIdOf = (eventId: string, seq: number) => `can-${eventId}-${seq}`;

const eventIdFromId = (id: string, prefix: 'drw' | 'drr' | 'can') => {
    const match = new RegExp(`^${prefix}-(.+?)-(?:r\\d+|\\d+)(?:-s\\d+)?$`).exec(id);
    return match?.[1] ?? null;
};

/* ── 시드 ── */

function buildCandidates(eventId: string): DrawCandidate[] {
    const random = seededRandom(`${eventId}:candidates`);
    return Array.from({ length: CANDIDATE_COUNT }, (_, index) => {
        const seq = String(index + 1).padStart(3, '0');
        // 실제 차감 장수(등급별)와 가중치를 구분해 보여주기 위해 등급을 섞는다
        const bronze = Math.floor(random() * 3);
        const silver = Math.floor(random() * 2);
        const gold = random() < 0.2 ? 1 : 0;
        const ticketCount = Math.max(1, bronze + silver + gold);
        const weight =
            bronze * GRADE_WEIGHT.bronze + silver * GRADE_WEIGHT.silver + gold * GRADE_WEIGHT.gold;
        return {
            id: `cand-${eventId}-${seq}`,
            participantId: `part-${eventId}-${seq}`,
            userId: `user-${seq}`,
            // ADR-028 표시용 현재 이름 — 스냅샷 객체에는 넣지 않고 응답 필드로만 싣는다
            userName: `사용자${seq}`,
            ticketCount,
            weight: Math.max(1, weight),
            entrySnapshot: { bronze, silver, gold },
            eligibilitySnapshot: {
                eligible: true,
                membership: index % 3 === 0 ? 'vip' : 'excellent',
            },
        };
    });
}

function eventInfoOf(
    eventId: string,
): { endsAt: string; prizes: MockPrize[]; canceled: boolean; publishedSeed: boolean } | null {
    const extra = EXTRA_EVENTS[eventId];
    if (extra) {
        return {
            endsAt: new Date(mockNow().getTime() + extra.endsAtOffsetMin * MINUTE).toISOString(),
            prizes: extra.prizes,
            canceled: extra.canceled ?? false,
            publishedSeed: extra.published ?? false,
        };
    }
    const event = mockEvents.find((e) => e.id === eventId);
    if (!event) return null;
    return {
        endsAt: event.endsAt,
        prizes: [{ id: `${event.id}-prize-1`, rank: 1, winnerCount: event.winnerCount }],
        canceled: false,
        // 사용자 시드의 status:'drawn'은 이미 공개된 과거 이벤트를 뜻한다 — 시각과 무관한 명시적 시드다
        publishedSeed: event.status === 'drawn',
    };
}

const slotKey = (prizeId: string, slotNumber: number) => `${prizeId}:${slotNumber}`;

/** 최초 추첨의 결과 — 같은 이벤트는 언제 뽑아도 같은 결과다 (결정적 난수) */
function drawInitialResults(store: DrawStore): DrawResult[] {
    const random = seededRandom(`${store.eventId}:1`);
    const pool = [...store.candidates];
    const results: DrawResult[] = [];
    let order = 0;

    for (const prize of [...store.prizes].sort((a, b) => a.rank - b.rank)) {
        const slots = Math.min(prize.winnerCount, SLOT_LIMIT);
        for (let slot = 1; slot <= slots; slot += 1) {
            const winner = pool.length > 0 ? pickWeighted(pool, random) : null;
            if (winner) pool.splice(pool.indexOf(winner), 1);
            if (winner) order += 1;
            results.push({
                id: resultIdOf(store.eventId, 1, results.length + 1),
                prizeId: prize.id,
                prizeRank: prize.rank,
                slotNumber: slot,
                selectionOrder: winner ? order : null,
                // 후보가 모자라면 채우지 못한 슬롯을 미충원으로 확정한다
                resultType: winner ? 'SELECTED' : 'UNFILLED',
                candidateId: winner?.id ?? null,
                userId: winner?.userId ?? null,
                userName: winner?.userName ?? null,
                wasPublished: false,
                isCanceled: false,
            });
        }
    }
    return results;
}

function drawFirstRun(store: DrawStore, endsAt: string): MockRun {
    const results = drawInitialResults(store);
    // ADR-026 — 최초 자동 추첨은 마감 + 1분부터 대상이다. getStore도 같은 시각에 실행을 만든다
    const confirmedAt = new Date(new Date(endsAt).getTime() + DRAW_DELAY_MS).toISOString();
    return {
        detail: {
            id: runIdOf(store.eventId, 1),
            eventId: store.eventId,
            runNumber: 1,
            drawType: 'INITIAL',
            status: 'CONFIRMED',
            originalDrawId: null,
            startedAt: confirmedAt,
            confirmedAt,
            createdAt: confirmedAt,
            algorithmVersion: 'weighted-draw-v1',
            rulesSnapshot: {
                weighting: 'bronze1-silver3-gold5',
                candidateCount: store.candidates.length,
            },
            snapshotFixedAt: confirmedAt,
            results,
            execution: {
                failureCount: 0,
                latestFailure: null,
                retryAt: null,
                waitingForOperator: false,
                cancellations: [],
            },
        },
        candidateIds: store.candidates.map((c) => c.id),
        progressFrom: null,
        vacancy: null,
        appliedPublication: null,
    };
}

/** 이 이벤트의 현재 명단 — 슬롯별로 취소되지 않은 가장 최근 확정 선정 결과 */
function effectiveList(store: DrawStore, upToRun = Number.POSITIVE_INFINITY) {
    const list = new Map<string, string | null>();
    for (const run of store.runs) {
        if (run.detail.status !== 'CONFIRMED' || run.detail.runNumber > upToRun) continue;
        for (const result of run.detail.results) {
            const key = slotKey(result.prizeId, result.slotNumber);
            if (result.resultType === 'UNFILLED') {
                if (!list.has(key)) list.set(key, null);
            } else {
                list.set(key, result.isCanceled ? null : result.userId);
            }
        }
    }
    return list;
}

/** 최초 공개 반영 — 명단을 확정하고 revision 1의 변경 이력을 남긴다. 실행별 근거는 호출부가 넘긴다 */
function markFirstPublication(
    store: DrawStore,
    confirmation: {
        confirmedBy: string | null;
        confirmedAt: string | null;
        reason?: string | null;
        executions?: PublicListChange['executions'];
        /** 공개 시각 — 과거 공개 시드는 과거 시각을 넘기고, 생략하면 현재 시각 */
        at?: string;
    },
) {
    store.firstPublished = true;
    store.revision = 1;
    const at = confirmation.at ?? mockNow().toISOString();
    store.publishedAt = at;
    // 최초 공개 전에 확정된 재추첨 결과도 관리자 확인을 거쳤다면 최초 명단에 함께 실린다
    const confirmedRuns = store.runs.filter((r) => r.detail.status === 'CONFIRMED');
    for (const run of confirmedRuns) {
        for (const result of run.detail.results) {
            if (result.resultType === 'SELECTED') result.wasPublished = true;
        }
    }
    const latest = confirmedRuns[confirmedRuns.length - 1];
    store.changes.push({
        id: `chg-${store.eventId}-1`,
        publicationId: `pub-${store.eventId}-1`,
        revision: 1,
        drawRunId: latest?.detail.id ?? '',
        // 공개 시드는 확인 근거가 없는 과거 공개를 재현한다 — 수동 발표는 호출부가 채운다
        reason: confirmation.reason ?? null,
        confirmedBy: confirmation.confirmedBy,
        confirmedByName: actorNameOf(confirmation.confirmedBy),
        confirmedAt: confirmation.confirmedAt,
        updatedAt: at,
        changes: [...effectiveList(store)].map(([key, afterUserId]) => {
            const [prizeId, slot] = key.split(':') as [string, string];
            return {
                prizeId,
                slotNumber: Number(slot),
                beforeUserId: null,
                beforeUserName: null,
                afterUserId,
                afterUserName: candidateNameOf(store, afterUserId),
            };
        }),
        executions: (confirmation.executions ?? []).map((exec) => ({
            ...exec,
            confirmedByName: actorNameOf(exec.confirmedBy),
        })),
    });
    store.publicList = effectiveList(store);
}

/** 이 실행의 execution.cancellations — 이 실행을 발생시킨 취소와 이 실행의 결과가 이후 취소된 근거 (취소 시각·ID 오름차순) */
const runCancellations = (store: DrawStore, run: MockRun): CancellationSummary[] =>
    store.cancellations
        .filter(
            (c) =>
                c.replacementRunId === run.detail.id ||
                run.detail.results.some((r) => r.id === c.resultId),
        )
        .map((c) => ({
            id: c.cancellationId,
            resultId: c.resultId,
            replacementRunId: c.replacementRunId,
            canceledBy: c.canceledBy,
            canceledByName: actorNameOf(c.canceledBy),
            reason: c.reason,
            canceledAt: c.canceledAt,
        }))
        .sort((a, b) => a.canceledAt.localeCompare(b.canceledAt) || a.id.localeCompare(b.id));

/** AD02 응답 — 취소 근거는 저장소에서 파생해 싣는다 */
const serializeDetail = (store: DrawStore, run: MockRun): DrawRunDetail => ({
    ...run.detail,
    execution: { ...run.detail.execution, cancellations: runCancellations(store, run) },
});

const recordAudit = (
    store: DrawStore,
    runId: string,
    entry: Omit<DrawExecutionAudit, 'id' | 'runId' | 'createdAt'>,
) => {
    store.audits.push({
        id: `aud-${store.eventId}-${store.audits.length + 1}`,
        runId,
        createdAt: mockNow().toISOString(),
        ...entry,
    });
};

function createRedrawRun(
    store: DrawStore,
    canceled: { result: DrawResult; runId: string },
    canceledAt: string,
    actor: string,
): { run: MockRun; cancellationId: string } {
    const runNumber = store.runs.length + 1;
    const cancellationId = cancellationIdOf(store.eventId, store.cancellations.length + 1);
    const used = new Set<string>();
    for (const run of store.runs) {
        for (const result of run.detail.results) {
            if (result.userId) used.add(result.userId);
        }
    }
    // 재추첨 후보는 최초 후보 정보를 재사용하되 기존 당첨자·취소자를 제거한다
    const candidateIds = store.candidates.filter((c) => !used.has(c.userId)).map((c) => c.id);
    const run: MockRun = {
        detail: {
            id: runIdOf(store.eventId, runNumber),
            eventId: store.eventId,
            runNumber,
            drawType: 'REPLACEMENT',
            status: 'PREPARING',
            originalDrawId: runIdOf(store.eventId, 1),
            startedAt: null,
            confirmedAt: null,
            createdAt: canceledAt,
            algorithmVersion: 'weighted-draw-v1',
            rulesSnapshot: { weighting: 'bronze1-silver3-gold5', fillVacanciesOnly: true },
            snapshotFixedAt: canceledAt,
            results: [],
            execution: {
                failureCount: 0,
                latestFailure: null,
                retryAt: null,
                waitingForOperator: false,
                cancellations: [],
            },
        },
        candidateIds,
        progressFrom: Date.now(),
        vacancy: {
            prizeId: canceled.result.prizeId,
            prizeRank: canceled.result.prizeRank,
            slotNumber: canceled.result.slotNumber,
        },
        appliedPublication: null,
    };
    store.runs.push(run);
    // AD05는 등록과 함께 서버가 즉시 실행한다 — 감사의 action 값 집합은 DRAW_EXECUTE·DRAW_RESUME뿐이다
    recordAudit(store, run.detail.id, {
        actorId: actor,
        action: 'DRAW_EXECUTE',
        reason: null,
        beforeData: 'status:PREPARING',
        afterData: `attemptId:att-${run.detail.id}-1`,
        requestId: null,
    });
    return { run, cancellationId };
}

function seedFailedRedraw(store: DrawStore) {
    const first = store.runs[0]!;
    const target = first.detail.results.find((r) => r.resultType === 'SELECTED');
    if (!target) return;
    target.isCanceled = true;
    const canceledAt = new Date(mockNow().getTime() - 10 * MINUTE).toISOString();
    const { run, cancellationId } = createRedrawRun(
        store,
        { result: target, runId: first.detail.id },
        canceledAt,
        'vu-admin',
    );
    store.cancellations.push({
        key: `seed-${store.eventId}`,
        resultId: target.id,
        reason: '당첨자 본인 확인 실패',
        cancellationId,
        canceledBy: 'vu-admin',
        canceledAt,
        replacementRunId: run.detail.id,
    });
    run.progressFrom = null;
    run.detail.status = 'FAILED';
    run.detail.startedAt = canceledAt;
    // 재시도 예약이 남은 실패 — 운영자 대기(waitingForOperator)와 구분해 보여준다
    const failedAt = new Date(mockNow().getTime() - 8 * MINUTE).toISOString();
    const retryAt = new Date(mockNow().getTime() + 30 * MINUTE).toISOString();
    const failure: DrawFailure = {
        id: `flr-${store.eventId}-1`,
        runId: run.detail.id,
        failureCode: 'TRANSIENT_STORAGE',
        message: '추첨 선정 중 일시적인 오류가 발생했습니다. 같은 실행을 재개할 수 있습니다.',
        failedAt,
        traceId: 'trace-0199-demo-draw-failure',
    };
    store.failures.push(
        { ...failure, id: `flr-${store.eventId}-0`, failedAt: canceledAt },
        failure,
    );
    run.detail.execution.failureCount = 2;
    run.detail.execution.latestFailure = failure;
    run.detail.execution.retryAt = retryAt;
}

/** 최초 추첨이 선정 중 실패한 상태로 만든다 — 확정 결과가 없고 재개로만 이어진다. 자동 재시도가 없어 운영자 대기다 */
function seedFailedInitialRun(store: DrawStore) {
    const { detail } = store.runs[0]!;
    detail.status = 'FAILED';
    detail.confirmedAt = null;
    detail.results = [];
    const failedAt = new Date(mockNow().getTime() - 5 * MINUTE).toISOString();
    const failure: DrawFailure = {
        id: `flr-${store.eventId}-1`,
        runId: detail.id,
        failureCode: 'INTERRUPTED',
        message: '추첨 선정 중 일시적인 오류가 발생했습니다. 같은 실행을 재개할 수 있습니다.',
        failedAt,
        traceId: 'trace-0199-demo-initial-draw-failure',
    };
    store.failures.push(failure);
    detail.execution.failureCount = 1;
    detail.execution.latestFailure = failure;
    detail.execution.waitingForOperator = true;
    // 실패 자체는 감사 action이 아니다 — 실패 이력은 /failures가 소유하고 감사에는 실행·재개만 남는다
}

function getStore(eventId: string): DrawStore | null {
    const now = mockNow().getTime();
    const existing = stores.get(eventId);
    if (existing) {
        advanceStore(existing);
        return existing;
    }
    const info = eventInfoOf(eventId);
    if (!info) return null;
    // 최초 추첨은 마감 + 1분부터 대상이다 — 그 전에는 스토어를 만들지 않고 빈 목록으로 응답한다
    if (now < new Date(info.endsAt).getTime() + DRAW_DELAY_MS) return null;

    const store: DrawStore = {
        eventId,
        prizes: info.prizes,
        candidates: buildCandidates(eventId),
        runs: [],
        canceled: info.canceled,
        firstPublished: false,
        publishedAt: null,
        publicList: new Map(),
        revision: 0,
        changes: [],
        verifications: [],
        cancellations: [],
        failures: [],
        audits: [],
        initialConfirmation: null,
    };
    store.runs.push(drawFirstRun(store, info.endsAt));
    // 자동 최초 추첨의 실행이 업무 감사에 남는다 — 시스템 행위라 actorId는 null이다
    recordAudit(store, store.runs[0]!.detail.id, {
        actorId: null,
        action: 'DRAW_EXECUTE',
        reason: null,
        beforeData: 'status:PREPARING',
        afterData: `attemptId:att-${store.runs[0]!.detail.id}-1`,
        requestId: null,
    });
    if (info.publishedSeed) {
        // 공개 시드 — 당첨자 공개 요청 없이 시간만 지나도 공개되지 않는다는 규칙의 유일한 예외다.
        // 근거 없는 과거 공개로 재현하고, 공개 시각은 최초 추첨 확정 뒤로 고정한다
        markFirstPublication(store, {
            confirmedBy: null,
            confirmedAt: null,
            at: new Date(new Date(info.endsAt).getTime() + 2 * MINUTE).toISOString(),
        });
    }
    if (eventId === '20000000-0000-4000-8000-000000000904') seedFailedRedraw(store);
    if (eventId === FAILED_INITIAL_EVENT) seedFailedInitialRun(store);
    stores.set(eventId, store);
    return store;
}

/** 진행 중인 실행만 시간에 따라 전이시킨다 — 공개는 요청 성공으로만 생겨 여기서 만들지 않는다 (ADR-022) */
function advanceStore(store: DrawStore) {
    for (const run of store.runs) advanceRun(store, run);
}

function advanceRun(store: DrawStore, run: MockRun) {
    if (run.progressFrom === null) return;
    const elapsed = Date.now() - run.progressFrom;
    const { detail } = run;
    if (detail.status === 'PREPARING' && elapsed >= PREPARING_MS) {
        detail.status = 'RUNNING';
        detail.startedAt = mockNow().toISOString();
    }
    if (detail.status === 'RUNNING' && elapsed >= CONFIRM_MS) {
        confirmRun(store, run);
    }
}

/** 빈 슬롯 하나를 후보에서 선정해 확정한다 — 후보가 없으면 미충원으로 확정한다 */
function confirmRun(store: DrawStore, run: MockRun) {
    const { vacancy, detail } = run;
    if (!vacancy) {
        // 재개된 최초 실행 — 고정된 후보로 전체 슬롯을 한 번에 확정한다
        if (detail.runNumber !== 1) return;
        detail.results = drawInitialResults(store);
        detail.status = 'CONFIRMED';
        detail.confirmedAt = mockNow().toISOString();
        run.progressFrom = null;
        return;
    }
    // 취소자를 포함해 이미 한 번 당첨된 사용자는 다시 뽑지 않는다
    const everSelected = new Set<string>();
    for (const other of store.runs) {
        for (const result of other.detail.results) {
            if (result.userId) everSelected.add(result.userId);
        }
    }
    const pool = store.candidates.filter(
        (c) => run.candidateIds.includes(c.id) && !everSelected.has(c.userId),
    );
    const winner =
        pool.length > 0
            ? pickWeighted(pool, seededRandom(`${store.eventId}:${detail.runNumber}`))
            : null;
    detail.results = [
        {
            id: resultIdOf(store.eventId, detail.runNumber, vacancy.slotNumber),
            prizeId: vacancy.prizeId,
            prizeRank: vacancy.prizeRank,
            slotNumber: vacancy.slotNumber,
            selectionOrder: winner ? 1 : null,
            resultType: winner ? 'SELECTED' : 'UNFILLED',
            candidateId: winner?.id ?? null,
            userId: winner?.userId ?? null,
            userName: winner?.userName ?? null,
            wasPublished: false,
            isCanceled: false,
        },
    ];
    detail.status = 'CONFIRMED';
    detail.confirmedAt = mockNow().toISOString();
    run.progressFrom = null;
}

/* ── 응답 직렬화·공통 처리 ── */

function toRun(detail: DrawRunDetail): DrawRun {
    return {
        id: detail.id,
        eventId: detail.eventId,
        runNumber: detail.runNumber,
        drawType: detail.drawType,
        status: detail.status,
        originalDrawId: detail.originalDrawId,
        startedAt: detail.startedAt,
        confirmedAt: detail.confirmedAt,
        createdAt: detail.createdAt,
    };
}

/** 시작·재개 응답 — 확정이면 저장된 결과를, 아니면 confirmation:null을 싣는다 (GD-87·GD-138) */
function toExecution(detail: DrawRunDetail): DrawExecutionResponse {
    return {
        runId: detail.id,
        status: detail.status,
        confirmation:
            detail.status === 'CONFIRMED' && detail.confirmedAt
                ? {
                      confirmedAt: detail.confirmedAt,
                      results: detail.results.map((r) => ({
                          resultId: r.id,
                          prizeId: r.prizeId,
                          rank: r.prizeRank,
                          slotNumber: r.slotNumber,
                          selectionOrder: r.selectionOrder,
                          candidateId: r.candidateId,
                          userId: r.userId,
                          userName: r.userName,
                          resultType: r.resultType,
                      })),
                  }
                : null,
    };
}

function paginate<T>(items: T[], url: URL) {
    const page = Math.max(1, Number(url.searchParams.get('page')) || 1);
    const size = Math.min(100, Math.max(1, Number(url.searchParams.get('size')) || 20));
    return {
        items: items.slice((page - 1) * size, page * size),
        page,
        size,
        totalElements: items.length,
    };
}

const notFound = () => fail(404, 'RESOURCE_NOT_FOUND', '요청한 대상을 찾을 수 없습니다.');
const conflict = (message: string, code = 'STATE_CONFLICT') => fail(409, code, message);
const forbidden = () => fail(403, 'ACCESS_DENIED', '이 작업을 수행할 권한이 없습니다.');

const actorOf = (request: Request) => request.headers.get('X-User-ID') || DEFAULT_ACTOR;

// ADR-028 — ID 옆에 싣는 표시용 현재 이름. ID가 null(시스템 처리·빈 자리)이면 이름도 null이다.
// 가상 사용자 목록에 없는 ID는 이름 조회가 불가하므로 ID를 그대로 대신 보여 준다
const actorNameOf = (actorId: string | null) =>
    actorId === null ? null : (findMockVirtualUser(actorId)?.name ?? actorId);
const candidateNameOf = (store: DrawStore, userId: string | null) =>
    userId === null
        ? null
        : (store.candidates.find((c) => c.userId === userId)?.userName ?? userId);

/** X-User-ID가 없으면 시연 기본 관리자로 본다. 있으면 가상 사용자의 역할이 ADMIN이어야 한다 */
const isAdminContext = (request: Request) => {
    const userId = request.headers.get('X-User-ID');
    return !userId || findMockVirtualUser(userId)?.role === 'ADMIN';
};

function findRun(drawId: string) {
    const eventId = eventIdFromId(drawId, 'drw');
    const store = eventId ? getStore(eventId) : null;
    const run = store?.runs.find((r) => r.detail.id === drawId);
    return store && run ? { store, run } : null;
}

function findResult(winId: string) {
    const eventId = eventIdFromId(winId, 'drr');
    const store = eventId ? getStore(eventId) : null;
    if (!store) return null;
    for (const run of store.runs) {
        const result = run.detail.results.find((r) => r.id === winId);
        if (result) return { store, run, result };
    }
    return null;
}

function findCancellation(cancellationId: string) {
    const eventId = eventIdFromId(cancellationId, 'can');
    const store = eventId ? getStore(eventId) : null;
    const stored = store?.cancellations.find((c) => c.cancellationId === cancellationId);
    const run = store?.runs.find((r) => r.detail.id === stored?.replacementRunId);
    return store && run ? { store, run } : null;
}

const cancellationBody = (stored: StoredCancellation, run: MockRun) => ({
    cancellationId: stored.cancellationId,
    canceledDrawResultId: stored.resultId,
    replacementDrawRunId: run.detail.id,
    status: run.detail.status,
    canceledAt: stored.canceledAt,
});

/** 테스트에서 상태를 초기화할 때 쓴다 */
export function resetMockDraws() {
    stores.clear();
}

/**
 * 다른 목업(이벤트·관리자 이벤트·공개 결과)이 같은 공개 사실을 읽을 때 쓴다.
 * 공개는 추첨 확정·정합성 검증·시간 경과가 아니라 당첨자 공개 요청 성공으로만 생긴다 (ADR-022).
 * 스토어가 없으면(추첨 대상 전·없는 이벤트) 공개되지 않은 것으로 본다.
 */
export function getMockDrawOverview(eventId: string) {
    const store = getStore(eventId);
    return {
        published: store?.firstPublished ?? false,
        publishedAt: store?.publishedAt ?? null,
        revision: store?.revision ?? null,
        hasConfirmedRun: store?.runs.some((r) => r.detail.status === 'CONFIRMED') ?? false,
        hasRunningReplacement:
            store?.runs.some(
                (r) =>
                    r.detail.drawType === 'REPLACEMENT' &&
                    (r.detail.status === 'PREPARING' || r.detail.status === 'RUNNING'),
            ) ?? false,
    } as const;
}

export const drawHandlers = [
    // AD01 — 이벤트의 추첨 실행 목록 (Page). 마감 전 이벤트는 빈 목록이다
    http.get(api('/v1/admin/events/:eventId/draws'), ({ params, request }) => {
        const eventId = String(params.eventId);
        if (!eventInfoOf(eventId)) return notFound();
        const store = getStore(eventId);
        const runs = store ? [...store.runs].reverse().map((r) => toRun(r.detail)) : [];
        return ok(paginate(runs, new URL(request.url)));
    }),

    // AD02 — 실행 상세 (취소 근거·결과·실패 정보 포함)
    http.get(api('/v1/admin/draws/:drawId'), ({ params }) => {
        const found = findRun(String(params.drawId));
        return found ? ok(serializeDetail(found.store, found.run)) : notFound();
    }),

    // AD03 — 해당 실행이 실제 사용한 후보 명단 (Page)
    http.get(api('/v1/admin/draws/:drawId/participants'), ({ params, request }) => {
        const found = findRun(String(params.drawId));
        if (!found) return notFound();
        const ids = new Set(found.run.candidateIds);
        const candidates = found.store.candidates.filter((c) => ids.has(c.id));
        return ok(paginate(candidates, new URL(request.url)));
    }),

    // AD04 — 정합성 검증. 난수를 다시 돌리지 않고 저장된 결과가 후보·규칙과 맞는지 확인한다
    http.post(api('/v1/admin/draws/:drawId/checks'), ({ params, request }) => {
        const found = findRun(String(params.drawId));
        if (!found) return notFound();
        const { store, run } = found;
        const { detail } = run;
        if (detail.status !== 'CONFIRMED')
            return conflict('확정되지 않은 추첨 실행은 검증할 수 없습니다.');

        const ids = new Set(run.candidateIds);
        const selected = detail.results.filter((r) => r.resultType === 'SELECTED');
        const activeUsers = store.runs
            .flatMap((r) => r.detail.results)
            .filter((r) => r.resultType === 'SELECTED' && !r.isCanceled)
            .map((r) => r.userId);
        const canceledUsers = new Set(
            store.runs
                .flatMap((r) => r.detail.results)
                .filter((r) => r.isCanceled)
                .map((r) => r.userId),
        );
        const expectedSlots =
            detail.runNumber === 1
                ? store.prizes.reduce((sum, p) => sum + Math.min(p.winnerCount, SLOT_LIMIT), 0)
                : store.cancellations.filter((c) => c.replacementRunId === detail.id).length;
        const checks = [
            {
                code: 'WINNER_IN_CANDIDATES',
                passed: selected.every((r) => r.candidateId && ids.has(r.candidateId)),
                message: '모든 당첨자가 실행 시점의 후보 명단에 포함돼 있습니다.',
            },
            {
                code: 'NO_DUPLICATE_WINNER',
                passed: new Set(activeUsers).size === activeUsers.length,
                message: '한 사용자가 이벤트에서 두 번 당첨되지 않았습니다.',
            },
            {
                code: 'SLOT_COUNT_MATCH',
                passed: detail.results.length === expectedSlots,
                message: '경품 슬롯 수와 결과 수가 일치합니다.',
            },
            {
                code: 'CANCELED_EXCLUDED',
                passed:
                    detail.runNumber === 1 ||
                    selected.every((r) => !r.userId || !canceledUsers.has(r.userId)),
                message: '당첨 취소자가 재추첨 결과에서 제외됐습니다.',
            },
            {
                code: 'SNAPSHOT_FIXED_BEFORE_CONFIRM',
                passed:
                    Boolean(detail.snapshotFixedAt) &&
                    Boolean(detail.confirmedAt) &&
                    new Date(detail.snapshotFixedAt!).getTime() <=
                        new Date(detail.confirmedAt!).getTime(),
                message: '후보 명단은 확정 이전에 고정됐습니다.',
            },
        ];
        const verification: DrawVerification = {
            id: `chk-${detail.id}-${store.verifications.length + 1}`,
            drawRunId: detail.id,
            passed: checks.every((c) => c.passed),
            checks,
            verifiedAt: mockNow().toISOString(),
            verifiedBy: actorOf(request),
            verifiedByName: actorNameOf(actorOf(request)),
        };
        store.verifications.push(verification);
        return ok(verification, 201);
    }),

    // AD08 — 검증 이력 (Page, 최신순)
    http.get(api('/v1/admin/draws/:drawId/checks'), ({ params, request }) => {
        const found = findRun(String(params.drawId));
        if (!found) return notFound();
        const history = found.store.verifications
            .filter((v) => v.drawRunId === found.run.detail.id)
            .reverse();
        return ok(paginate(history, new URL(request.url)));
    }),

    // AD05 — 당첨 취소 + 재추첨 등록. 같은 키·같은 본문은 200으로 기존 결과를 돌려준다
    http.post(api('/v1/admin/wins/:winId/cancellations'), async ({ params, request }) => {
        if (!isAdminContext(request)) return forbidden();
        // 확정 계약(GD-169): UUID 멱등키 필수, 사유는 양끝 공백 제거 후 1~1000자, 오류는 CANCEL-001~004다
        const key = request.headers.get(IDEMPOTENCY_HEADER)?.trim();
        if (!key || !z.uuid().safeParse(key).success) {
            return fail(400, 'CANCEL-004', '멱등키는 UUID 형식으로 필요합니다.');
        }
        const body = (await request.json().catch(() => null)) as unknown;
        const parsedBody = awardCancellationRequestSchema.safeParse(body);
        if (!parsedBody.success)
            return fail(400, 'CANCEL-004', '취소 사유는 공백 제외 1~1000자로 입력해야 합니다.');
        const { reason } = parsedBody.data;

        const found = findResult(String(params.winId));
        if (!found) return fail(404, 'CANCEL-001', '취소 대상을 찾을 수 없습니다.');
        const { store, run, result } = found;

        const replay = store.cancellations.find((c) => c.key === key);
        if (replay) {
            if (replay.resultId !== result.id || replay.reason !== reason) {
                return conflict('같은 멱등키로 다른 요청을 보낼 수 없습니다.', 'CANCEL-003');
            }
            const replacement = store.runs.find((r) => r.detail.id === replay.replacementRunId)!;
            return ok(cancellationBody(replay, replacement), 200);
        }

        const cancelConflict = (message: string) => conflict(message, 'CANCEL-002');
        if (store.canceled) return cancelConflict('취소된 이벤트의 당첨은 취소할 수 없습니다.');
        if (result.isCanceled) return cancelConflict('이미 취소된 당첨입니다.');
        if (result.resultType !== 'SELECTED')
            return cancelConflict('미충원 결과는 취소할 수 없습니다.');
        // 미확정 REPLACEMENT가 있는 동안에는 다른 당첨의 새 취소를 받지 않는다 (기존 취소 재요청·AD09는 허용)
        if (store.runs.some((r) => r.detail.runNumber > 1 && r.detail.status !== 'CONFIRMED')) {
            return cancelConflict('진행 중인 재추첨이 있어 새 당첨 취소를 받을 수 없습니다.');
        }
        if (run.detail.status !== 'CONFIRMED') {
            return cancelConflict('확정되지 않은 추첨 결과는 취소할 수 없습니다.');
        }

        const canceledAt = mockNow().toISOString();
        const actor = actorOf(request);
        result.isCanceled = true;
        const { run: replacement, cancellationId } = createRedrawRun(
            store,
            { result, runId: run.detail.id },
            canceledAt,
            actor,
        );
        const stored: StoredCancellation = {
            key,
            resultId: result.id,
            reason,
            cancellationId,
            canceledBy: actor,
            canceledAt,
            replacementRunId: replacement.detail.id,
        };
        store.cancellations.push(stored);
        return ok(cancellationBody(stored, replacement), 202);
    }),

    // AD06 — 최초 발표 이후 재추첨 결과를 공개 명단에 반영한다 (최초 공개 전 확인은 후속 계약).
    // 요청 본문이 없는 계약이다 — 변경 이력의 사유는 연결된 취소의 사유를 쓴다 (05-api/drawing.md)
    http.post(api('/v1/admin/draws/:drawId/publication'), ({ params, request }) => {
        const found = findRun(String(params.drawId));
        if (!found) return notFound();
        const { store, run } = found;
        const { detail } = run;

        if (detail.runNumber === 1)
            return conflict('재추첨 실행만 공개 명단에 반영할 수 있습니다.');
        if (detail.status !== 'CONFIRMED')
            return conflict('확정되지 않은 실행은 반영할 수 없습니다.');
        if (store.canceled) return conflict('취소된 이벤트는 공개 명단을 갱신할 수 없습니다.');
        if (!store.firstPublished) return conflict('최초 발표 전에는 이 API로 반영할 수 없습니다.');
        // 같은 실행의 재반영은 revision·변경 이력을 새로 만들지 않는다
        if (run.appliedPublication) return ok(run.appliedPublication, 200);

        const next = effectiveList(store, detail.runNumber);
        const changes: PublicListChange['changes'] = [];
        for (const [key, afterUserId] of next) {
            const beforeUserId = store.publicList.get(key) ?? null;
            if (beforeUserId === afterUserId) continue;
            const [prizeId, slot] = key.split(':') as [string, string];
            changes.push({
                prizeId,
                slotNumber: Number(slot),
                beforeUserId,
                beforeUserName: candidateNameOf(store, beforeUserId),
                afterUserId,
                afterUserName: candidateNameOf(store, afterUserId),
            });
        }

        const now = mockNow().toISOString();
        const actor = actorOf(request);
        store.revision += 1;
        const update: PublicationUpdateResult = {
            eventId: store.eventId,
            publicationId: `pub-${store.eventId}-${store.revision}`,
            drawRunId: detail.id,
            revision: store.revision,
            publishedAt: now,
            updatedAt: now,
            updatedBy: actor,
            updatedByName: actorNameOf(actor),
        };
        // 계약은 본문 없음 — 이력의 사유·실행별 취소 근거는 이 재추첨을 만든 취소에서 가져온다
        const causing = store.cancellations.filter((c) => c.replacementRunId === detail.id);
        store.changes.push({
            id: `chg-${store.eventId}-${store.revision}`,
            publicationId: update.publicationId,
            revision: update.revision,
            drawRunId: detail.id,
            reason: causing[0]?.reason ?? null,
            confirmedBy: actor,
            confirmedByName: actorNameOf(actor),
            confirmedAt: now,
            updatedAt: now,
            changes,
            executions: [
                {
                    runId: detail.id,
                    confirmationId: `conf-${detail.id}`,
                    confirmedBy: actor,
                    confirmedByName: actorNameOf(actor),
                    confirmedAt: now,
                    cancellations: causing.map((c) => ({
                        id: c.cancellationId,
                        resultId: c.resultId,
                        reason: c.reason,
                    })),
                },
            ],
        });
        store.publicList = next;
        // 이 반영에 포함된 확정 실행은 모두 공개 이력이 생긴다
        for (const other of store.runs) {
            if (other.detail.status !== 'CONFIRMED' || other.detail.runNumber > detail.runNumber)
                continue;
            for (const result of other.detail.results) {
                if (result.resultType === 'SELECTED') result.wasPublished = true;
            }
            if (other.detail.runNumber > 1 && !other.appliedPublication)
                other.appliedPublication = update;
        }
        return ok(update, 200);
    }),

    // AD07 — 공개 명단 변경 이력 (Page, 최신 revision 먼저)
    http.get(api('/v1/admin/events/:eventId/result-changes'), ({ params, request }) => {
        const eventId = String(params.eventId);
        if (!eventInfoOf(eventId)) return notFound();
        const store = getStore(eventId);
        const changes = store ? [...store.changes].reverse() : [];
        return ok(paginate(changes, new URL(request.url)));
    }),

    // GD-199 — 최신 검토 실행의 최종 확인·최초 공개를 본문 없는 한 요청으로 처리한다.
    // 같은 runId의 재요청은 저장된 결과를 돌려주고, 다른 runId·이전 실행·미확정은 거절한다
    http.post(api('/v1/admin/draws/:runId/result-confirmation'), ({ params, request }) => {
        if (!isAdminContext(request))
            return fail(403, 'PUBLICATION-003', '활성 관리자가 아닙니다.');
        const runId = String(params.runId);
        const eventId = eventIdFromId(runId, 'drw');
        const store = eventId ? getStore(eventId) : null;
        const run = store?.runs.find((r) => r.detail.id === runId);
        if (!store || !run) return fail(404, 'PUBLICATION-004', '추첨 실행을 찾을 수 없습니다.');

        // 이미 발표된 이벤트 — 최초 발표에 사용한 같은 실행의 재요청만 기존 결과를 돌려준다
        if (store.firstPublished) {
            if (store.initialConfirmation?.runId === runId) {
                return ok(store.initialConfirmation, 200);
            }
            return fail(
                409,
                'PUBLICATION-005',
                '이미 발표된 이벤트입니다. 명단 갱신은 공개 명단 반영(AD06)을 사용해 주세요.',
            );
        }
        if (store.canceled) {
            return fail(409, 'PUBLICATION-005', '취소된 이벤트는 발표할 수 없습니다.');
        }
        // 명단 변경 검사 — 요청한 실행이 최신이 아니면 검토 시점과 다른 명단이다
        const latest = store.runs.reduce((a, b) =>
            a.detail.runNumber > b.detail.runNumber ? a : b,
        );
        if (run.detail.id !== latest.detail.id) {
            return fail(
                409,
                'PUBLICATION-005',
                '검토한 명단이 변경되었습니다. 최신 명단을 다시 확인해 주세요.',
            );
        }
        if (
            store.runs.some((r) => r.detail.status !== 'CONFIRMED') ||
            run.detail.results.length === 0
        ) {
            return fail(409, 'PUBLICATION-002', '추첨 결과가 아직 발표 가능한 상태가 아닙니다.');
        }

        const now = mockNow().toISOString();
        const actor = actorOf(request);
        const confirmedRuns = store.runs.filter((r) => r.detail.status === 'CONFIRMED');
        const executions = confirmedRuns.map((r) => ({
            runId: r.detail.id,
            confirmationId: `conf-${r.detail.id}`,
            confirmedBy: actor,
            confirmedByName: actorNameOf(actor),
            confirmedAt: now,
            cancellations: runCancellations(store, r)
                .filter((c) => c.replacementRunId === r.detail.id)
                .map((c) => ({ id: c.id, resultId: c.resultId, reason: c.reason })),
        }));
        markFirstPublication(store, {
            confirmedBy: actor,
            confirmedAt: now,
            reason: store.cancellations[0]?.reason ?? null,
            executions,
        });
        const confirmation: DrawResultConfirmation = {
            eventId: store.eventId,
            confirmationId: `conf-${run.detail.id}`,
            runId: run.detail.id,
            confirmedBy: actor,
            confirmedByName: actorNameOf(actor),
            confirmedAt: now,
            isPublished: true,
            publicationId: `pub-${store.eventId}-1`,
            revision: 1,
            publishedAt: now,
        };
        store.initialConfirmation = confirmation;
        return ok(confirmation, 200);
    }),

    // GD-137 — 실행의 실패 이력 (failedAt·id 내림차순)
    http.get(api('/v1/admin/draws/:drawId/failures'), ({ params, request }) => {
        const found = findRun(String(params.drawId));
        if (!found) return notFound();
        const history = found.store.failures
            .filter((f) => f.runId === found.run.detail.id)
            .sort((a, b) => b.failedAt.localeCompare(a.failedAt) || b.id.localeCompare(a.id));
        return ok(paginate(history, new URL(request.url)));
    }),

    // GD-137 — 실행의 업무 감사 이력 (createdAt·id 내림차순). MockAudit의 runId는 응답에서 뺀다
    http.get(api('/v1/admin/draws/:drawId/execution-audits'), ({ params, request }) => {
        const found = findRun(String(params.drawId));
        if (!found) return notFound();
        const history = found.store.audits
            .filter((a) => a.runId === found.run.detail.id)
            .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id))
            // 목업 내부 필드 runId는 응답에서 뺀다
            .map((a) => ({
                id: a.id,
                actorId: a.actorId,
                actorName: actorNameOf(a.actorId),
                action: a.action,
                reason: a.reason,
                beforeData: a.beforeData,
                afterData: a.afterData,
                requestId: a.requestId,
                createdAt: a.createdAt,
            }));
        return ok(paginate(history, new URL(request.url)));
    }),

    // 최초 추첨 실패 재개 (GD-87) — 활성 관리자만, 본문 없음. 확정이면 저장 결과 200, 미확정·진행 중이면 202
    http.post(api('/v1/admin/draws/:runId/resume'), ({ params, request }) => {
        if (!isAdminContext(request)) return forbidden();
        const found = findRun(String(params.runId));
        if (!found) return notFound();
        const { store, run } = found;
        const { detail } = run;
        // REPLACEMENT(재추첨) 실행은 AD09로만 재개한다
        if (detail.drawType !== 'INITIAL') return conflict('최초 추첨 실행만 재개할 수 있습니다.');
        if (store.canceled) return conflict('취소된 이벤트의 추첨은 재개할 수 없습니다.');

        if (detail.status === 'CONFIRMED') return ok(toExecution(detail), 200);
        // NO_ENTRIES·NO_CANDIDATES는 확정 종료라 재개하지 않는다
        if (detail.status === 'NO_ENTRIES' || detail.status === 'NO_CANDIDATES')
            return conflict('종료된 추첨 실행은 재개할 수 없습니다.');
        if (detail.status === 'FAILED') {
            detail.status = 'PREPARING';
            detail.execution.retryAt = null;
            detail.execution.waitingForOperator = false;
            run.progressFrom = Date.now();
            recordAudit(store, detail.id, {
                actorId: actorOf(request),
                action: 'DRAW_RESUME',
                reason: null,
                beforeData: 'status:FAILED',
                // 재개는 실패 횟수 다음의 새 실행 시도다
                afterData: `attemptId:att-${detail.id}-${detail.execution.failureCount + 1}`,
                requestId: null,
            });
        }
        return ok(toExecution(detail), 202);
    }),

    // AD09 — 취소에 연결된 재추첨 실행의 시작·재개. 응답은 DrawExecutionResponse이고 확정된 실행은 저장 결과를 돌려준다
    http.post(api('/v1/admin/cancellations/:cancellationId/redraws'), ({ params, request }) => {
        if (!isAdminContext(request)) return forbidden();
        const found = findCancellation(String(params.cancellationId));
        if (!found) return notFound();
        const { store, run } = found;
        if (store.canceled) return conflict('취소된 이벤트의 재추첨은 시작·재개할 수 없습니다.');

        const { detail } = run;
        if (detail.status === 'CONFIRMED') return ok(toExecution(detail), 200);
        // NO_ENTRIES·NO_CANDIDATES는 확정 종료라 재개하지 않는다
        if (detail.status === 'NO_ENTRIES' || detail.status === 'NO_CANDIDATES')
            return conflict('종료된 추첨 실행은 재개할 수 없습니다.');
        if (detail.status === 'FAILED') {
            detail.status = 'PREPARING';
            detail.execution.retryAt = null;
            detail.execution.waitingForOperator = false;
            run.progressFrom = Date.now();
            recordAudit(store, detail.id, {
                actorId: actorOf(request),
                action: 'DRAW_RESUME',
                reason: null,
                beforeData: 'status:FAILED',
                // 재개는 실패 횟수 다음의 새 실행 시도다
                afterData: `attemptId:att-${detail.id}-${detail.execution.failureCount + 1}`,
                requestId: null,
            });
        }
        return ok(toExecution(detail), 202);
    }),
];
