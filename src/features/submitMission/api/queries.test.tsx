import type { ReactNode } from 'react';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react';
import { AxiosError } from 'axios';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ApiError, apiClient } from '@shared/api/client';

import { useSubmitMission } from './queries';

afterEach(() => vi.restoreAllMocks());
describe('미션 제출 원본 재시도', () => {
    it('응답 형식이 없는 HTTP 503도 같은 키를 유지한다', async () => {
        const failure = new AxiosError('실패');
        Object.assign(failure, { response: { status: 503 } });
        const post = vi.spyOn(apiClient, 'post').mockRejectedValue(failure);
        const client = new QueryClient();
        const wrapper = ({ children }: { children: ReactNode }) => (
            <QueryClientProvider client={client}>{children}</QueryClientProvider>
        );
        const hook = renderHook(() => useSubmitMission('mission'), { wrapper });
        const answers = [{ questionId: 'q', answerText: '원본' }];
        await act(async () => {
            await hook.result.current.mutateAsync(answers).catch(() => undefined);
        });
        await act(async () => {
            await hook.result.current.mutateAsync(answers).catch(() => undefined);
        });
        expect(post.mock.calls[1]?.[2]).toEqual(post.mock.calls[0]?.[2]);
    });
    it.each([429, 503])('%s 이후 같은 키와 원본을 유지한다', async (status) => {
        const post = vi
            .spyOn(apiClient, 'post')
            .mockRejectedValue(new ApiError('COMMON-006', '대기', status, 0));
        const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
        const wrapper = ({ children }: { children: ReactNode }) => (
            <QueryClientProvider client={client}>{children}</QueryClientProvider>
        );
        const hook = renderHook(() => useSubmitMission('mission'), { wrapper });
        const answers = [{ questionId: 'q', answerText: '원본' }];
        await act(async () => {
            await hook.result.current.mutateAsync(answers).catch(() => undefined);
        });
        await act(async () => {
            await hook.result.current.mutateAsync(answers).catch(() => undefined);
        });
        expect(post.mock.calls[1]?.[2]).toEqual(post.mock.calls[0]?.[2]);
        expect(post.mock.calls[1]?.[1]).toEqual({ answers });
    });
});
