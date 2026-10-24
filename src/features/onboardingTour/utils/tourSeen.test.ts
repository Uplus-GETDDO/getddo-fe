import { describe, expect, it } from 'vitest';

import { hasSeenTour, markTourSeen } from './tourSeen';

const memoryStorage = (): Storage => {
    const map = new Map<string, string>();
    return {
        get length() {
            return map.size;
        },
        clear: () => map.clear(),
        getItem: (key) => map.get(key) ?? null,
        key: (index) => [...map.keys()][index] ?? null,
        removeItem: (key) => void map.delete(key),
        setItem: (key, value) => void map.set(key, value),
    };
};

const throwingStorage = (): Storage => ({
    ...memoryStorage(),
    getItem: () => {
        throw new Error('blocked');
    },
    setItem: () => {
        throw new Error('blocked');
    },
});

describe('첫 방문 안내 본 표시', () => {
    it('사용자마다 따로 기억한다', () => {
        const storage = memoryStorage();
        expect(hasSeenTour('u-1', storage)).toBe(false);
        markTourSeen('u-1', storage);
        expect(hasSeenTour('u-1', storage)).toBe(true);
        expect(hasSeenTour('u-2', storage)).toBe(false);
    });

    it('저장소를 못 쓰면 본 것으로 보고 다시 띄우지 않는다', () => {
        const storage = throwingStorage();
        expect(hasSeenTour('u-1', storage)).toBe(true);
        expect(() => markTourSeen('u-1', storage)).not.toThrow();
    });
});
