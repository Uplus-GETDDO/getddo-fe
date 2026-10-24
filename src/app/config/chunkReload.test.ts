import { describe, expect, it, vi } from 'vitest';

import { installChunkReload } from './chunkReload';

function setup(start = 100_000) {
    const target = new EventTarget();
    const store = new Map<string, string>();
    const storage = {
        getItem: (key: string) => store.get(key) ?? null,
        setItem: (key: string, value: string) => void store.set(key, value),
    };
    const reload = vi.fn();
    let time = start;
    installChunkReload({
        target: target as unknown as Window,
        storage,
        reload,
        now: () => time,
    });
    const fire = () => {
        const event = new Event('vite:preloadError', { cancelable: true });
        target.dispatchEvent(event);
        return event;
    };
    return { fire, reload, advance: (ms: number) => (time += ms) };
}

describe('installChunkReload', () => {
    it('화면 조각을 못 받으면 오류 화면 대신 한 번 새로고침한다', () => {
        const { fire, reload } = setup();
        const event = fire();
        expect(reload).toHaveBeenCalledTimes(1);
        expect(event.defaultPrevented).toBe(true);
    });

    it('새로고침 직후 또 실패하면 다시 새로고침하지 않고 오류 화면을 둔다', () => {
        const { fire, reload, advance } = setup();
        fire();
        advance(3_000);
        const event = fire();
        expect(reload).toHaveBeenCalledTimes(1);
        expect(event.defaultPrevented).toBe(false);
    });

    it('시간이 지나 다음 배포로 다시 실패하면 또 새로고침한다', () => {
        const { fire, reload, advance } = setup();
        fire();
        advance(60_000);
        fire();
        expect(reload).toHaveBeenCalledTimes(2);
    });
});
