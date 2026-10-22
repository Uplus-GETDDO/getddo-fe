import { QueryClientProvider, useQuery } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import { act } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { queryClient } from './queryClient';

function setVisibility(state: 'visible' | 'hidden') {
    Object.defineProperty(document, 'visibilityState', {
        configurable: true,
        get: () => state,
    });
    Object.defineProperty(document, 'hidden', {
        configurable: true,
        get: () => state === 'hidden',
    });
    document.dispatchEvent(new Event('visibilitychange'));
}

describe('queryClient 기본 폴링 정책', () => {
    afterEach(() => {
        setVisibility('visible');
        vi.useRealTimers();
        queryClient.clear();
    });

    it('탭이 숨겨지면 주기 재조회를 멈추고 다시 보이면 재개한다', async () => {
        vi.useFakeTimers();
        const queryFn = vi.fn(() => Promise.resolve('ok'));
        function Probe() {
            useQuery({ queryKey: ['probe'], queryFn, refetchInterval: 100 });
            return null;
        }
        render(
            <QueryClientProvider client={queryClient}>
                <Probe />
            </QueryClientProvider>,
        );
        await act(async () => {
            await vi.advanceTimersByTimeAsync(1000);
        });
        expect(queryFn.mock.calls.length).toBeGreaterThan(1);

        setVisibility('hidden');
        queryFn.mockClear();
        await act(async () => {
            await vi.advanceTimersByTimeAsync(1000);
        });
        expect(queryFn).not.toHaveBeenCalled();

        setVisibility('visible');
        await act(async () => {
            await vi.advanceTimersByTimeAsync(1000);
        });
        expect(queryFn.mock.calls.length).toBeGreaterThan(0);
    });
});
