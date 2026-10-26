import type { ReactNode } from 'react';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ApiError, apiClient } from '@shared/api/client';

import { useCheckAttendance } from './queries';

afterEach(() => vi.restoreAllMocks());
const setup = () => {
    const client = new QueryClient();
    const wrapper = ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
    return renderHook(() => useCheckAttendance(), { wrapper });
};
describe('출석 요청 가드', () => {
    it('같은 틱의 중복 요청도 한 번만 전송한다', async () => {
        const post = vi.spyOn(apiClient, 'post').mockResolvedValue({
            data: {
                success: true,
                data: {
                    attendanceId: 'a',
                    attendanceDate: '2026-10-20',
                    consecutiveDays: 1,
                    rewards: [],
                    createdAt: '2026-10-20T00:00:00Z',
                },
            },
        });
        const hook = setup();
        await act(async () => {
            await Promise.allSettled([
                hook.result.current.mutateAsync({}),
                hook.result.current.mutateAsync({}),
            ]);
        });
        expect(post).toHaveBeenCalledTimes(1);
    });
    it('429 대기 중 재클릭으로 요청을 우회하지 않는다', async () => {
        const post = vi
            .spyOn(apiClient, 'post')
            .mockRejectedValue(new ApiError('COMMON-006', '잠시 대기', 429, 30));
        const hook = setup();
        await act(async () => {
            await hook.result.current.mutateAsync({}).catch(() => undefined);
        });
        await act(async () => {
            await hook.result.current.mutateAsync({}).catch(() => undefined);
        });
        expect(post).toHaveBeenCalledTimes(1);
    });
    it('지연 응답 중 10회 연타도 한 번만 전송한다', async () => {
        const post = vi.spyOn(apiClient, 'post').mockImplementation(
            () =>
                new Promise((resolve) =>
                    setTimeout(
                        () =>
                            resolve({
                                data: {
                                    success: true,
                                    data: {
                                        attendanceId: 'a',
                                        attendanceDate: '2026-10-20',
                                        consecutiveDays: 1,
                                        rewards: [],
                                        createdAt: '2026-10-20T00:00:00Z',
                                    },
                                },
                            }),
                        30,
                    ),
                ),
        );
        const hook = setup();
        await act(async () => {
            await Promise.allSettled(
                Array.from({ length: 10 }, () => hook.result.current.mutateAsync({})),
            );
        });
        expect(post).toHaveBeenCalledTimes(1);
    });
    it('첫 시도가 실패해도 재시도는 다시 전송한다', async () => {
        const post = vi
            .spyOn(apiClient, 'post')
            .mockRejectedValueOnce(new ApiError('SERVER-001', '일시 오류', 500))
            .mockResolvedValue({
                data: {
                    success: true,
                    data: {
                        attendanceId: 'a',
                        attendanceDate: '2026-10-20',
                        consecutiveDays: 1,
                        rewards: [],
                        createdAt: '2026-10-20T00:00:00Z',
                    },
                },
            });
        const hook = setup();
        await act(async () => {
            await hook.result.current.mutateAsync({}).catch(() => undefined);
        });
        await act(async () => {
            await hook.result.current.mutateAsync({});
        });
        expect(post).toHaveBeenCalledTimes(2);
    });
});
