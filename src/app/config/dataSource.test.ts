import { describe, expect, it, vi } from 'vitest';

import { getDataSource, resolveDataSource } from './dataSource';

function memoryStorage() {
    const store = new Map<string, string>();
    return {
        getItem: (key: string) => store.get(key) ?? null,
        setItem: (key: string, value: string) => void store.set(key, value),
    };
}

describe('resolveDataSource', () => {
    it('서버가 응답하면 실서버로 시작한다', async () => {
        const source = await resolveDataSource({
            forceMock: false,
            search: '',
            storage: memoryStorage(),
            probe: () => Promise.resolve(true),
        });
        expect(source).toBe('live');
        expect(getDataSource()).toBe('live');
    });

    it('서버가 닿지 않으면 목업으로 시작한다', async () => {
        const source = await resolveDataSource({
            forceMock: false,
            search: '',
            storage: memoryStorage(),
            probe: () => Promise.resolve(false),
        });
        expect(source).toBe('mock');
        expect(getDataSource()).toBe('mock');
    });

    it('로컬 개발처럼 늘 목업인 빌드는 서버를 확인하지 않는다', async () => {
        const probe = vi.fn(() => Promise.resolve(true));
        const source = await resolveDataSource({
            forceMock: true,
            search: '',
            storage: memoryStorage(),
            probe,
        });
        expect(source).toBe('mock');
        expect(probe).not.toHaveBeenCalled();
    });

    it('?demo=1이면 확인 없이 목업으로 고정하고, 같은 탭의 다음 방문에도 유지한다', async () => {
        const storage = memoryStorage();
        const probe = vi.fn(() => Promise.resolve(true));
        await resolveDataSource({ forceMock: false, search: '?demo=1', storage, probe });
        const next = await resolveDataSource({ forceMock: false, search: '', storage, probe });
        expect(next).toBe('mock');
        expect(probe).not.toHaveBeenCalled();
    });

    it('?demo=0이면 서버가 닿지 않아도 실서버로 고정한다', async () => {
        const source = await resolveDataSource({
            forceMock: false,
            search: '?demo=0',
            storage: memoryStorage(),
            probe: () => Promise.resolve(false),
        });
        expect(source).toBe('live');
    });

    it('저장소가 막힌 브라우저에서도 서버 확인으로 정한다', async () => {
        const source = await resolveDataSource({
            forceMock: false,
            search: '',
            storage: {
                getItem: () => {
                    throw new DOMException('blocked', 'SecurityError');
                },
                setItem: () => {},
            },
            probe: () => Promise.resolve(false),
        });
        expect(source).toBe('mock');
    });
});
