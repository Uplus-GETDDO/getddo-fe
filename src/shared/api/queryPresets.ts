// 대기 시각은 오류와 함께 쿼리 캐시에 남는다. 앱의 가상 시계나 시스템 시각 변경의 영향을 받지 않는다.
import type { QueryFunctionContext } from '@tanstack/react-query';

import { isAxiosError } from 'axios';
import { ZodError } from 'zod';

import { ApiError, parseRetryAfter } from './client';

/**
 * 쿼리 캐싱 프리셋 — 도메인 데이터의 성격별 정책을 한곳에서 정의한다.
 * 쿼리마다 staleTime·refetchInterval을 제각각 적으면 같은 데이터가 화면마다 다르게 동작한다.
 * 사용: useQuery({ ...queryPresets.realtime, queryKey, queryFn })
 */
export const queryPresets = {
    /** 실시간 현황(참여자 수·응모권 사용 수 등) — 30초 폴링으로 서버 값을 계속 따라간다 */
    realtime: {
        staleTime: 0,
        refetchInterval: 30_000,
    },
    /**
     * 세션 동안 자주 바뀌지 않는 읽기 데이터 — 전역 기본값(staleTime 30초)을 명시적으로 쓸 때.
     * 옵션을 그대로 두는 것과 동일하며, "이 데이터는 이 정책"이라는 의도 표시용이다
     */
    standard: {
        staleTime: 30_000,
    },
    /** 캐싱하면 안 되는 데이터(관리자 검토 목록 등) — 화면에 들어올 때마다 서버에서 새로 받는다 */
    noCache: {
        staleTime: 0,
        gcTime: 0,
        refetchOnMount: 'always',
    },
} as const;

// 대기 시각은 오류와 함께 쿼리 캐시에 남아 가상 시계·시스템 시각 변경의 영향을 받지 않는다.
type ReadError = Error & { pollingRetryAt?: number };
// 브라우저 타이머의 최대 지연 — 서버가 준 기한 자체는 자르지 않고 각 예약 단계만 자른다
const MAX_TIMER_DELAY_MS = 2_147_483_647;
const boundedPollingDelay = (delay: number) => Math.min(delay, MAX_TIMER_DELAY_MS);
const errorStatus = (error: unknown) =>
    error instanceof ApiError
        ? error.status
        : isAxiosError(error)
          ? error.response?.status
          : undefined;
const stopsPolling = (error: unknown) =>
    error instanceof ZodError || [400, 401, 403, 404].includes(errorStatus(error) ?? 0);

/** 429 응답 이후 실제 경과 시간 기준으로 남은 대기 시간(ms). UI의 재시도 안내에도 사용한다. */
export function getPollingRetryDelay(error: unknown): number {
    if (!(error instanceof Error) || errorStatus(error) !== 429) return 0;
    const readError = error as ReadError;
    if (readError.pollingRetryAt === undefined) {
        const seconds =
            error instanceof ApiError
                ? error.retryAfterSeconds
                : isAxiosError(error)
                  ? parseRetryAfter(error.response?.headers?.['retry-after'])
                  : undefined;
        readError.pollingRetryAt = performance.now() + (seconds ?? 30) * 1000;
    }
    return Math.max(0, readError.pollingRetryAt - performance.now());
}

export const pollingReadPolicy = {
    retry: (failureCount: number, error: unknown) => !stopsPolling(error) && failureCount < 1,
    retryDelay: (_attempt: number, error: unknown) =>
        errorStatus(error) === 429 ? boundedPollingDelay(getPollingRetryDelay(error)) : 1000,
    // 종결 오류로 데이터 없이 실패한 쿼리는 재마운트 때도 자동 재요청하지 않는다 — 복구는 명시적 refetch()로만
    retryOnMount: false,
};

export function pollingReadInterval(
    query: { state: { error: unknown } },
    active = true,
): number | false {
    if (!active || stopsPolling(query.state.error)) return false;
    const retryDelay = getPollingRetryDelay(query.state.error);
    // 잘린 단계가 만료되면 가드가 같은 대기 오류를 다시 던져 남은 기한을 재계산한다
    return retryDelay ? boundedPollingDelay(retryDelay) : queryPresets.realtime.refetchInterval;
}

/** refetch·재마운트·무효화 경로도 같은 캐시 오류를 검사해 서버 대기 시간을 우회하지 않는다. */
export async function withPollingReadGuard<T>(
    context: QueryFunctionContext,
    request: () => Promise<T>,
): Promise<T> {
    // 최초 실패 뒤 fetch를 시작하면 state.error가 지워지므로 Query 수명에 묶어 대기 근거를 보존한다.
    const query = context.client
        .getQueryCache()
        .find({ queryKey: context.queryKey, exact: true }) as
        (object & { pollingReadError?: unknown }) | undefined;
    const error = query?.pollingReadError;
    if (getPollingRetryDelay(error) > 0) throw error;
    try {
        const result = await request();
        if (query) delete query.pollingReadError;
        return result;
    } catch (error) {
        getPollingRetryDelay(error);
        if (query) query.pollingReadError = error;
        throw error;
    }
}
