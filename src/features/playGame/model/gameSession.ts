import type { GameSubmission } from '../api/queries';
import type { ValidationData } from './types';

import { createRun, pressJump, releaseJump, stepRun } from './takkoRun';
import { validationDataSchema } from './types';

export function createXorshift32(seed: number) {
    let state = seed | 0;
    return () => {
        state ^= state << 13;
        state ^= state >>> 17;
        state ^= state << 5;
        return (state >>> 0) / 4294967296;
    };
}

// 단조 증가 시계의 활성 구간만 합산한다.
export class ActiveClock {
    private elapsed = 0;
    private started: number | null = null;
    reset() {
        this.elapsed = 0;
        this.started = null;
    }
    resume(now: number) {
        if (this.started === null) this.started = now;
    }
    pause(now: number) {
        if (this.started !== null) {
            this.elapsed += Math.max(0, now - this.started);
            this.started = null;
        }
    }
    read(now: number) {
        return Math.floor(
            this.elapsed + (this.started === null ? 0 : Math.max(0, now - this.started)),
        );
    }
}
export function snapshotSubmission(playToken: string, validationData: ValidationData) {
    const body = { playToken, validationData: validationDataSchema.parse(validationData) };
    if (new TextEncoder().encode(JSON.stringify(body)).length > 1048576)
        throw new Error('게임 입력이 1MiB 한도를 초과했습니다. 기록을 줄여 제출할 수 없습니다.');
    return structuredClone(body);
}

// 미확정 제출 원본의 보존 — sessionStorage라 탭을 닫으면 함께 지워지고 다른 세션·사용자에게 남지 않는다.
// 새로고침·화면 이동 후에도 같은 원본으로 결과를 재확인하기 위한 것으로, 쓰기·읽기 실패는
// 비공개 모드·용량 초과일 수 있으므로 조용히 메모리 상태로만 둔다.
const PENDING_STORAGE_PREFIX = 'getddo.gamePlay.pending.';

export function loadPendingSubmission(key: string): GameSubmission | undefined {
    try {
        const raw = sessionStorage.getItem(PENDING_STORAGE_PREFIX + key);
        if (!raw) return undefined;
        return JSON.parse(raw) as GameSubmission;
    } catch {
        return undefined;
    }
}
export function savePendingSubmission(key: string, input: GameSubmission) {
    try {
        sessionStorage.setItem(PENDING_STORAGE_PREFIX + key, JSON.stringify(input));
    } catch {
        /* 저장 불가 환경 — 이번 탭 동안은 메모리 상태가 유지된다 */
    }
}
export function clearPendingSubmission(key: string) {
    try {
        sessionStorage.removeItem(PENDING_STORAGE_PREFIX + key);
    } catch {
        /* 저장소 접근 불가 시 지울 대상도 없다 */
    }
}

export class FixedRun {
    readonly run = createRun();
    readonly inputs: { tick: number; type: 'press' | 'release' }[] = [];
    endTick = -1;
    private accumulator = 0;
    private pending: ('press' | 'release')[] = [];
    private random: () => number;
    private maxTicks: number;
    constructor(seed: number, maxTicks: number) {
        this.random = createXorshift32(seed);
        this.maxTicks = maxTicks;
    }
    input(type: 'press' | 'release') {
        if (this.run.phase === 'over') return;
        if (this.inputs.length >= 10000)
            throw new Error(
                '점프 입력 한도에 도달했습니다. 이 판은 정상 완료로 제출하지 않습니다.',
            );
        if (this.run.phase === 'ready' && type === 'release') return;
        if (this.run.phase === 'ready') this.run.phase = 'running';
        this.inputs.push({ tick: this.endTick + 1, type });
        this.pending.push(type);
    }
    advance(seconds: number) {
        if (this.run.phase !== 'running') {
            this.accumulator = 0;
            return false;
        }
        this.accumulator += seconds;
        let ended = false;
        while (this.accumulator >= 1 / 120 && this.run.phase === 'running') {
            this.accumulator -= 1 / 120;
            for (const type of this.pending) {
                if (type === 'press') pressJump(this.run);
                else releaseJump(this.run);
            }
            this.pending = [];
            this.endTick += 1;
            ended = stepRun(this.run, 1 / 120, this.random) || this.endTick === this.maxTicks - 1;
            if (ended) this.run.phase = 'over';
        }
        return ended;
    }
}
