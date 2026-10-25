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

    it('새로고침 시각을 저장하지 못하면 쉬는 시간 없이 반복되지 않게 새로고침하지 않는다', () => {
        const target = new EventTarget();
        const reload = vi.fn();
        installChunkReload({
            target: target as unknown as Window,
            storage: {
                getItem: () => null,
                setItem: () => {
                    throw new Error('QuotaExceededError');
                },
            },
            reload,
        });
        const event = new Event('vite:preloadError', { cancelable: true });
        target.dispatchEvent(event);
        expect(reload).not.toHaveBeenCalled();
        expect(event.defaultPrevented).toBe(false);
    });

    it('저장소를 읽기만 해도 던지는 브라우저에서도 시작은 멈추지 않는다', () => {
        const target = new EventTarget();
        const reload = vi.fn();
        const spy = vi.spyOn(window, 'sessionStorage', 'get').mockImplementation(() => {
            throw new DOMException('blocked', 'SecurityError');
        });
        expect(() =>
            installChunkReload({ target: target as unknown as Window, reload }),
        ).not.toThrow();
        target.dispatchEvent(new Event('vite:preloadError', { cancelable: true }));
        expect(reload).not.toHaveBeenCalled();
        spy.mockRestore();
    });
});
