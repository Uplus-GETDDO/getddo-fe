import type { ReactNode } from 'react';

import { QueryClient, QueryClientProvider, focusManager } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { apiClient, ApiError } from '@shared/api/client';

import { useEventResults, useMyResult, useMyResults } from './queries';

const resultData = (eventId: string, displayStatus = 'WAITING') => ({
    eventId,
    isPublished: false,
    displayStatus,
    publishedAt: null,
    revision: null,
    updatedAt: null,
    serverTime: '2026-10-20T00:00:00Z',
    prizes: [],
});
const myData = (eventId: string) => ({
    eventId,
    result: 'PENDING',
    isPublished: false,
    prize: null,
    revision: null,
    serverTime: '2026-10-20T00:00:00Z',
});
function setup() {
    const client = new QueryClient({
        defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } },
    });
    const wrapper = ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
    return { client, wrapper };
}
async function tick(ms = 1) {
    await act(async () => {
        await vi.advanceTimersByTimeAsync(ms);
    });
}
beforeEach(() => {
    vi.useFakeTimers();
    focusManager.setFocused(true);
});
afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
    focusManager.setFocused(undefined);
});

describe('결과 폴링 요청 범위', () => {
    it('발표 완료 E08과 E09는 최초 조회 뒤 세 주기 동안 추가 요청하지 않는다', async () => {
        const paths: string[] = [];
        vi.spyOn(apiClient, 'get').mockImplementation(async (path) => {
            await Promise.resolve();
            paths.push(String(path));
            const data = String(path).endsWith('/my-result')
                ? { ...myData('published'), result: 'LOST', isPublished: true, revision: 1 }
                : {
                      ...resultData('published', 'PUBLISHED'),
                      isPublished: true,
                      publishedAt: '2026-10-20T00:00:00Z',
                      revision: 1,
                  };
            return { data: { success: true, data } };
        });
        const { client, wrapper } = setup();
        const publicResult = renderHook(() => useEventResults('published'), { wrapper });
        const myResult = renderHook(() => useMyResult('published'), { wrapper });
        await tick();
        expect(publicResult.result.current.data?.isPublished).toBe(true);
        expect(myResult.result.current.data?.result).toBe('LOST');
        await tick(90_000);
        expect(paths).toEqual(['/v1/events/published/results', '/v1/events/published/my-result']);
        client.clear();
    });
    it('목록을 재마운트해도 숨긴 행의 전체 집계를 자동으로 다시 읽지 않는다', async () => {
        const counts: Record<string, number> = {};
        vi.spyOn(apiClient, 'get').mockImplementation(async (path) => {
            await Promise.resolve();
            const id = String(path).split('/')[3]!;
            counts[id] = (counts[id] ?? 0) + 1;
            return { data: { success: true, data: myData(id) } };
        });
        const { client, wrapper } = setup();
        const first = renderHook(() => useMyResults(['a', 'b'], ['a']), { wrapper });
        await tick();
        first.unmount();
        renderHook(() => useMyResults(['a', 'b'], ['a']), { wrapper });
        await tick();
        expect(counts).toEqual({ a: 1, b: 1 });
        await tick(60_000);
        expect(counts).toEqual({ a: 3, b: 1 });
        client.clear();
    });
    it.each(['CANCELED', 'NO_ENTRANTS'])(
        '%s는 미공개여도 2주기 뒤까지 최초 1회만 요청한다',
        async (status) => {
            let count = 0;
            vi.spyOn(apiClient, 'get').mockImplementation(async () => {
                await Promise.resolve();
                count++;
                return { data: { success: true, data: resultData('a', status) } };
            });
            const { client, wrapper } = setup();
            renderHook(() => useEventResults('a'), { wrapper });
            await tick();
            await tick(60_000);
            expect(count).toBe(1);
            client.clear();
        },
    );
    it('최초 전체 조회 후 표시 ID만 2주기 조회하며 범위 변경을 반영한다', async () => {
        const counts: Record<string, number> = {};
        vi.spyOn(apiClient, 'get').mockImplementation(async (path) => {
            await Promise.resolve();
            const id = String(path).split('/')[3]!;
            counts[id] = (counts[id] ?? 0) + 1;
            return { data: { success: true, data: myData(id) } };
        });
        const { client, wrapper } = setup();
        const hook = renderHook(({ visible }) => useMyResults(['a', 'b', 'c'], visible), {
            wrapper,
            initialProps: { visible: ['a'] },
        });
        await tick();
        await tick(60_000);
        expect(counts).toEqual({ a: 3, b: 1, c: 1 });
        hook.rerender({ visible: ['b'] });
        await tick(60_000);
        expect(counts).toEqual({ a: 3, b: 3, c: 1 });
        client.clear();
    });
    it('단건과 다건은 같은 키로 요청을 공유하고 숨긴 탭에서는 2주기를 멈춘다', async () => {
        let count = 0;
        vi.spyOn(apiClient, 'get').mockImplementation(async () => {
            await Promise.resolve();
            count++;
            return { data: { success: true, data: myData('a') } };
        });
        const { client, wrapper } = setup();
        renderHook(
            () => {
                useMyResult('a');
                return useMyResults(['a'], ['a']);
            },
            { wrapper },
        );
        await tick();
        expect(count).toBe(1);
        focusManager.setFocused(false);
        await tick(60_000);
        expect(count).toBe(1);
        focusManager.setFocused(true);
        await tick(60_000);
        expect(count).toBe(3);
        client.clear();
    });
    it('429 90초 대기 중 수동 재시도와 재마운트가 요청을 만들지 않고 정상 복구한다', async () => {
        let count = 0;
        vi.spyOn(apiClient, 'get').mockImplementation(async () => {
            await Promise.resolve();
            count++;
            if (count === 1) throw new ApiError('LIMIT', '대기', 429, 90);
            return { data: { success: true, data: myData('a') } };
        });
        const { client, wrapper } = setup();
        const first = renderHook(() => useMyResult('a'), { wrapper });
        await tick();
        await tick(30_000);
        act(() => {
            void first.result.current.refetch();
        });
        await tick();
        expect(count).toBe(1);
        first.unmount();
        renderHook(() => useMyResult('a'), { wrapper });
        await tick();
        await tick(29_999);
        expect(count).toBe(1);
        await tick(30_000);
        expect(count).toBe(2);
        expect(client.getQueryData(['draw-results', 'a', 'me'])).toEqual(myData('a'));
        client.clear();
    });
    it('25개 최초 집계와 표시 20개 폴링은 25/45/65회다', async () => {
        let count = 0;
        vi.spyOn(apiClient, 'get').mockImplementation(async (path) => {
            await Promise.resolve();
            count++;
            return { data: { success: true, data: myData(String(path).split('/')[3]!) } };
        });
        const { client, wrapper } = setup();
        const ids = Array.from({ length: 25 }, (_, i) => String(i));
        renderHook(() => useMyResults([...ids, ids[0]!], ids.slice(0, 20)), { wrapper });
        await tick();
        expect(count).toBe(25);
        await tick(30_000);
        expect(count).toBe(45);
        await tick(30_000);
        expect(count).toBe(65);
        client.clear();
    });
    it('E09 미공개 CANCELED는 종결로 추측하지 않는다', async () => {
        let count = 0;
        vi.spyOn(apiClient, 'get').mockImplementation(async () => {
            await Promise.resolve();
            count++;
            return { data: { success: true, data: { ...myData('a'), result: 'CANCELED' } } };
        });
        const { client, wrapper } = setup();
        renderHook(() => useMyResult('a'), { wrapper });
        await tick();
        await tick(60_000);
        expect(count).toBe(3);
        client.clear();
    });
    it.each([400, 403, 404])(
        '%i 오류는 최초 1회 뒤 2주기 동안 자동 요청을 중단한다',
        async (status) => {
            let count = 0;
            vi.spyOn(apiClient, 'get').mockImplementation(async () => {
                await Promise.resolve();
                count++;
                throw new ApiError('BAD', '실패', status);
            });
            const { client, wrapper } = setup();
            renderHook(() => useMyResult('a'), { wrapper });
            await tick();
            await tick(60_000);
            expect(count).toBe(1);
            client.clear();
        },
    );
    it('갱신 실패에도 이전 값과 성공 시각을 유지하고 다음 주기에 복구한다', async () => {
        let count = 0;
        vi.spyOn(apiClient, 'get').mockImplementation(async () => {
            await Promise.resolve();
            count++;
            if (count === 2 || count === 3) throw new ApiError('SERVER', '실패', 503);
            return {
                data: { success: true, data: { ...myData('a'), revision: count === 1 ? 12 : 15 } },
            };
        });
        const { client, wrapper } = setup();
        const hook = renderHook(() => useMyResult('a'), { wrapper });
        await tick();
        const updatedAt = hook.result.current.dataUpdatedAt;
        await tick(31_000);
        await tick();
        expect(count).toBe(3);
        expect(hook.result.current.data?.revision).toBe(12);
        expect(hook.result.current.dataUpdatedAt).toBe(updatedAt);
        expect(client.getQueryState(['draw-results', 'a', 'me'])?.status).toBe('error');
        await tick(30_000);
        expect(hook.result.current.data?.revision).toBe(15);
        expect(hook.result.current.dataUpdatedAt).toBeGreaterThan(updatedAt);
        client.clear();
    });
});
