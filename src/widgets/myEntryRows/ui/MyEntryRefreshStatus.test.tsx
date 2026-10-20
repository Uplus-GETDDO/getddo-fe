import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { useMyEntryRows } from '../hooks/useMyEntryRows';

import { MyEntryRefreshStatus } from './MyEntryRefreshStatus';

function query(
    overrides: Partial<ReturnType<typeof useMyEntryRows>> = {},
): ReturnType<typeof useMyEntryRows> {
    return {
        rows: [],
        isPending: false,
        isError: false,
        isEntriesRefreshError: false,
        isResultPending: false,
        isRateLimited: false,
        isResultError: false,
        isResultInitialError: false,
        isResultRefreshError: false,
        isFetching: false,
        oldestResultUpdatedAt: 1_000,
        refetch: vi.fn().mockResolvedValue([]),
        ...overrides,
    };
}

describe('응모 갱신 상태 안내', () => {
    it('지연된 백그라운드 요청은 상태 알림과 재조회 버튼에 영향을 주지 않는다', () => {
        const initial = query();
        const { rerender } = render(<MyEntryRefreshStatus query={initial} />);
        const message = screen.getByRole('status').textContent;
        rerender(<MyEntryRefreshStatus query={{ ...initial, isFetching: true }} />);
        expect(screen.getByRole('status').textContent).toBe(message);
        expect(screen.getByRole('button', { name: '전체 응모 다시 조회' })).toBeEnabled();
        rerender(<MyEntryRefreshStatus query={{ ...initial, oldestResultUpdatedAt: 60_000 }} />);
        expect(screen.getByRole('status').textContent).toBe(message);
        expect(screen.getByRole('status')).not.toHaveTextContent('성공 시각');
        expect(screen.getByText(/가장 오래된 성공 시각/)).toBeInTheDocument();
    });
    it('수동 조회만 버튼을 잠그고 중복 요청을 차단하며 완료 후 복구한다', async () => {
        let finish: (() => void) | undefined;
        const deferred = new Promise<void>((resolve) => {
            finish = resolve;
        });
        const refetch: ReturnType<typeof useMyEntryRows>['refetch'] = vi.fn(() =>
            deferred.then(() => [] as never),
        );
        render(<MyEntryRefreshStatus query={query({ refetch })} />);
        const button = screen.getByRole('button', { name: '전체 응모 다시 조회' });
        fireEvent.click(button);
        fireEvent.click(button);
        expect(button).toBeDisabled();
        expect(refetch).toHaveBeenCalledTimes(1);
        expect(screen.getByRole('status')).toHaveTextContent('응모 결과를 갱신하고 있어요.');
        await act(async () => {
            finish?.();
            await deferred;
        });
        expect(button).toBeEnabled();
    });
    it('갱신 실패와 요청 제한은 상태 알림으로 유지한다', () => {
        const { rerender } = render(
            <MyEntryRefreshStatus query={query({ isResultRefreshError: true })} />,
        );
        expect(screen.getByRole('status')).toHaveTextContent('갱신에 실패');
        rerender(<MyEntryRefreshStatus query={query({ isRateLimited: true })} />);
        expect(screen.getByRole('status')).toHaveTextContent('서버 요청 제한');
    });
});
