import type { ReactNode } from 'react';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { apiClient } from '@shared/api/client';
import { IDEMPOTENCY_HEADER } from '@shared/utils/idempotencyKey';

import { useEnterEvent } from './queries';

afterEach(() => vi.restoreAllMocks());

const EVENT_ID = 'evt-001';
const TICKETS = { BRONZE: 1 } as const;

const acceptedReceipt = {
    id: 'entry-1',
    eventId: EVENT_ID,
    eventTitle: '테스트 이벤트',
    requestedTicketCount: 1,
    requestedTicketsByGrade: { BRONZE: 1, SILVER: 0, GOLD: 0, PLATINUM: 0 },
    deductedTicketCount: 1,
    deductedTicketsByGrade: { BRONZE: 1, SILVER: 0, GOLD: 0, PLATINUM: 0 },
    status: 'ACCEPTED',
    requestedAt: '2026-10-20T00:00:00Z',
    acceptedAt: '2026-10-20T00:00:00Z',
    rejectionCode: null,
    rejectionReason: null,
};

const okResponse = { data: { success: true, data: acceptedReceipt } };
const ok = () => Promise.resolve(okResponse);
// 응답을 받지 못한 네트워크 오류 — response가 없어야 키가 유지된다
const networkError = () =>
    Object.assign(new Error('network down'), { isAxiosError: true, request: {} });
// 서버가 응답한 업무 거절 — 결과가 키에 묶여 저장되므로 다음 시도는 새 키다
const serverRejection = (status = 400) =>
    Object.assign(new Error('rejected'), {
        isAxiosError: true,
        response: { status, data: { success: false, code: 'ENTRY-006' } },
    });

const setup = () => {
    const client = new QueryClient();
    const wrapper = ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
    return renderHook(() => useEnterEvent(EVENT_ID), { wrapper });
};

// ReturnType 추론을 위해 spy 생성을 헬퍼로 감싼다 — vi.spyOn 직접 표기는 any로 풀려 lint에 걸린다
const spyOnPost = () => vi.spyOn(apiClient, 'post');

const keyOf = (post: ReturnType<typeof spyOnPost>, call: number): string | undefined =>
    (post.mock.calls[call]?.[2] as { headers?: Record<string, string> } | undefined)?.headers?.[
        IDEMPOTENCY_HEADER
    ];

describe('응모 멱등키 수명', () => {
    it('응답 유실 뒤 같은 장수로 재시도하면 같은 키를 보낸다', async () => {
        const post = spyOnPost().mockRejectedValueOnce(networkError()).mockImplementation(ok);
        const hook = setup();
        await act(async () => {
            await hook.result.current.mutateAsync({ ...TICKETS }).catch(() => undefined);
        });
        await act(async () => {
            await hook.result.current.mutateAsync({ ...TICKETS });
        });
        expect(post).toHaveBeenCalledTimes(2);
        expect(keyOf(post, 0)).toBe(keyOf(post, 1));
    });

    it('지연 응답 중 같은 장수 연타도 같은 키로 재전송된다', async () => {
        const post = spyOnPost().mockImplementation(
            () => new Promise((resolve) => setTimeout(() => resolve(okResponse), 30)),
        );
        const hook = setup();
        await act(async () => {
            await Promise.allSettled([
                hook.result.current.mutateAsync({ ...TICKETS }),
                hook.result.current.mutateAsync({ ...TICKETS }),
            ]);
        });
        expect(post).toHaveBeenCalledTimes(2);
        expect(keyOf(post, 0)).toBe(keyOf(post, 1));
    });

    it('생략된 등급과 0은 같은 요청으로 보고 키를 유지한다', async () => {
        const post = spyOnPost().mockRejectedValueOnce(networkError()).mockImplementation(ok);
        const hook = setup();
        await act(async () => {
            await hook.result.current.mutateAsync({ BRONZE: 1 }).catch(() => undefined);
        });
        await act(async () => {
            await hook.result.current.mutateAsync({ BRONZE: 1, SILVER: 0, GOLD: 0, PLATINUM: 0 });
        });
        expect(post).toHaveBeenCalledTimes(2);
        expect(keyOf(post, 0)).toBe(keyOf(post, 1));
    });

    it('접수 성공 뒤 의도적인 추가 응모는 새 키로 간다', async () => {
        const post = spyOnPost().mockImplementation(ok);
        const hook = setup();
        await act(async () => {
            await hook.result.current.mutateAsync({ ...TICKETS });
        });
        await act(async () => {
            await hook.result.current.mutateAsync({ ...TICKETS });
        });
        expect(post).toHaveBeenCalledTimes(2);
        expect(keyOf(post, 0)).not.toBe(keyOf(post, 1));
    });

    it('서버가 응답한 거절 뒤 재시도는 새 키로 간다', async () => {
        const post = spyOnPost().mockRejectedValueOnce(serverRejection(400)).mockImplementation(ok);
        const hook = setup();
        await act(async () => {
            await hook.result.current.mutateAsync({ ...TICKETS }).catch(() => undefined);
        });
        await act(async () => {
            await hook.result.current.mutateAsync({ ...TICKETS });
        });
        expect(post).toHaveBeenCalledTimes(2);
        expect(keyOf(post, 0)).not.toBe(keyOf(post, 1));
    });

    it('장수 맵이 바뀌면 같은 키를 쓰지 않는다 — 같은 키+다른 본문 충돌을 만들지 않는다', async () => {
        const post = spyOnPost().mockImplementation(ok);
        const hook = setup();
        await act(async () => {
            await hook.result.current.mutateAsync({ BRONZE: 1 });
        });
        await act(async () => {
            await hook.result.current.mutateAsync({ BRONZE: 2 });
        });
        expect(post).toHaveBeenCalledTimes(2);
        expect(keyOf(post, 0)).not.toBe(keyOf(post, 1));
    });

    it('화면 이탈 후 재진입하면 새 키가 된다 — 훅 attemptRef 수명은 마운트 단위다', async () => {
        const post = spyOnPost().mockRejectedValueOnce(networkError()).mockImplementation(ok);
        const hook = setup();
        await act(async () => {
            await hook.result.current.mutateAsync({ ...TICKETS }).catch(() => undefined);
        });
        hook.unmount();
        const remounted = setup();
        await act(async () => {
            await remounted.result.current.mutateAsync({ ...TICKETS });
        });
        expect(post).toHaveBeenCalledTimes(2);
        // 같은 의도라도 키는 새로 발급된다 — 중복 방지 최종 책임은 서버의 사용자·이벤트 기준 차감에 있다
        expect(keyOf(post, 0)).not.toBe(keyOf(post, 1));
    });
});
