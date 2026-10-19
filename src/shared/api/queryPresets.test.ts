import { QueryClient } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { ApiError, parseRetryAfter } from './client';
import {
    getPollingRetryDelay,
    pollingReadInterval,
    pollingReadPolicy,
    withPollingReadGuard,
} from './queryPresets';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('폴링 읽기 오류 정책', () => {
    it.each([400, 401, 403, 404])('%i는 재시도와 주기 조회를 중단한다', (status) => {
        const error = new ApiError('ERROR', '실패', status);
        expect(pollingReadPolicy.retry(0, error)).toBe(false);
        expect(pollingReadInterval({ state: { error } })).toBe(false);
    });
    it('네트워크와 5xx는 한 번만 재시도한다', () => {
        expect(pollingReadPolicy.retry(0, new Error('network'))).toBe(true);
        expect(pollingReadPolicy.retry(1, new Error('network'))).toBe(false);
        expect(pollingReadPolicy.retry(0, new ApiError('ERROR', '실패', 503))).toBe(true);
    });
    it('429 대기는 캐시 오류에 보존해 수동 재시도도 우회하지 못한다', async () => {
        const client = new QueryClient();
        const key = ['rate-limit'];
        let count = 0;
        const request = () => {
            count++;
            return Promise.reject(new ApiError('LIMIT', '실패', 429, 90));
        };
        const queryFn = (context: Parameters<typeof withPollingReadGuard>[0]) =>
            withPollingReadGuard(context, request);
        await client.fetchQuery({ queryKey: key, queryFn, retry: false }).catch(() => {});
        const error = client.getQueryState(key)!.error;
        expect(getPollingRetryDelay(error)).toBe(90_000);
        await vi.advanceTimersByTimeAsync(60_000);
        await client.fetchQuery({ queryKey: key, queryFn, retry: false }).catch(() => {});
        expect(count).toBe(1);
        expect(getPollingRetryDelay(error)).toBe(30_000);
        await vi.advanceTimersByTimeAsync(30_000);
        await client.fetchQuery({ queryKey: key, queryFn, retry: false }).catch(() => {});
        expect(count).toBe(2);
        client.clear();
    });
    it('종결 오류가 남은 쿼리는 데이터가 있어도 재마운트 재조회를 건너뛴다', () => {
        const remount = pollingReadPolicy.refetchOnMount;
        expect(remount({ state: { error: new ApiError('ERROR', '실패', 404) } })).toBe(false);
        expect(remount({ state: { error: null } })).toBe(true);
        expect(remount({ state: { error: new ApiError('LIMIT', '대기', 429, 90) } })).toBe(true);
    });
    it('스키마 오류는 재시도와 interval을 중단한다', () => {
        const parsed = z.number().safeParse('invalid');
        if (parsed.success) throw new Error('실패 fixture');
        expect(pollingReadPolicy.retry(0, parsed.error)).toBe(false);
        expect(pollingReadInterval({ state: { error: parsed.error } })).toBe(false);
    });
    it('헤더 없는 429는 30초를 기다리고 시스템 시각 변경으로 단축되지 않는다', async () => {
        const error = new ApiError('LIMIT', '대기', 429);
        expect(getPollingRetryDelay(error)).toBe(30_000);
        vi.setSystemTime(Date.now() + 86400_000);
        expect(getPollingRetryDelay(error)).toBe(30_000);
        await vi.advanceTimersByTimeAsync(10_000);
        expect(getPollingRetryDelay(error)).toBe(20_000);
    });
    it('HTTP-date Retry-After도 같은 대기 정책에 전달한다', () => {
        const now = Date.parse('2026-10-20T00:00:00Z');
        const seconds = parseRetryAfter('Tue, 20 Oct 2026 00:01:30 GMT', now);
        expect(seconds).toBe(90);
        const error = new ApiError('LIMIT', '대기', 429, seconds);
        expect(getPollingRetryDelay(error)).toBe(90_000);
    });
    it('코드 없는 Axios 429 응답도 Retry-After 헤더를 지킨다', () => {
        const error = Object.assign(new Error('대기'), {
            isAxiosError: true,
            response: { status: 429, headers: { 'retry-after': '90' } },
        });
        expect(getPollingRetryDelay(error)).toBe(90_000);
    });
    it('서버 대기가 타이머 한계를 넘으면 예약만 자르고 기한은 유지한다', async () => {
        const error = new ApiError('LIMIT', '대기', 429, 3_000_000);
        expect(getPollingRetryDelay(error)).toBeGreaterThan(2_147_483_647);
        expect(pollingReadPolicy.retryDelay(0, error)).toBe(2_147_483_647);
        expect(pollingReadInterval({ state: { error } })).toBe(2_147_483_647);
        await vi.advanceTimersByTimeAsync(2_147_483_647);
        // 잘린 단계가 끝나도 남은 서버 기한은 다시 계산된다
        expect(getPollingRetryDelay(error)).toBeGreaterThan(0);
        expect(pollingReadInterval({ state: { error } })).toBeGreaterThan(0);
    });
});
