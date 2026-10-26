import { afterEach, describe, expect, it, vi } from 'vitest';

import { unregisterMockServiceWorker } from './serviceWorkerCleanup';

function registration(scriptURL: string) {
    return {
        active: { scriptURL },
        waiting: null,
        installing: null,
        unregister: vi.fn().mockResolvedValue(true),
    };
}

describe('unregisterMockServiceWorker', () => {
    afterEach(() => vi.unstubAllGlobals());

    it('우리 앱의 mockServiceWorker.js 등록만 해제한다', async () => {
        const ours = registration('https://app.example/mockServiceWorker.js');
        const other = registration('https://app.example/push-sw.js');
        const scoped = registration('https://app.example/sub/mockServiceWorker.js');
        vi.stubGlobal('navigator', {
            serviceWorker: {
                getRegistrations: vi.fn().mockResolvedValue([ours, other, scoped]),
            },
        });

        await unregisterMockServiceWorker();

        expect(ours.unregister).toHaveBeenCalledTimes(1);
        expect(scoped.unregister).toHaveBeenCalledTimes(1);
        expect(other.unregister).not.toHaveBeenCalled();
    });

    it('waiting·installing 상태의 워커도 script URL로 판별한다', async () => {
        const waiting = {
            active: null,
            waiting: { scriptURL: 'https://app.example/mockServiceWorker.js' },
            installing: null,
            unregister: vi.fn().mockResolvedValue(true),
        };
        vi.stubGlobal('navigator', {
            serviceWorker: { getRegistrations: vi.fn().mockResolvedValue([waiting]) },
        });

        await unregisterMockServiceWorker();

        expect(waiting.unregister).toHaveBeenCalledTimes(1);
    });

    it('serviceWorker를 지원하지 않는 환경에서는 조용히 통과한다', async () => {
        vi.stubGlobal('navigator', {});

        await expect(unregisterMockServiceWorker()).resolves.toBeUndefined();
    });
});
