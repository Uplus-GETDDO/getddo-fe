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
