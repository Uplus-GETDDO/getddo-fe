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

describe('응모 갱신 상태 표시', () => {
    it('백그라운드 요청은 표시와 다시 받기 버튼에 영향을 주지 않는다', () => {
        const initial = query();
        const { rerender } = render(<MyEntryRefreshStatus query={initial} />);
        const button = screen.getByRole('button', { name: '지금 다시 받기' });
        const label = button.textContent;
        rerender(<MyEntryRefreshStatus query={{ ...initial, isFetching: true }} />);
        expect(button).toBeEnabled();
        expect(button.textContent).toBe(label);
        expect(button).toHaveTextContent('갱신');
    });
    it('직접 누른 조회만 버튼을 잠그고 중복 요청을 막으며 끝나면 풀린다', async () => {
        let finish: (() => void) | undefined;
        const deferred = new Promise<void>((resolve) => {
            finish = resolve;
        });
        const refetch: ReturnType<typeof useMyEntryRows>['refetch'] = vi.fn(() =>
            deferred.then(() => [] as never),
        );
        render(<MyEntryRefreshStatus query={query({ refetch })} />);
        const button = screen.getByRole('button', { name: '지금 다시 받기' });
        fireEvent.click(button);
        fireEvent.click(button);
        expect(button).toBeDisabled();
        expect(refetch).toHaveBeenCalledTimes(1);
        expect(button).toHaveTextContent('새로 받는 중');
        await act(async () => {
            finish?.();
            await deferred;
        });
        expect(button).toBeEnabled();
    });
    it('갱신 실패는 다시 시도로, 요청 제한은 기다린다는 안내로 보인다', () => {
        const { rerender } = render(
            <MyEntryRefreshStatus query={query({ isResultRefreshError: true })} />,
        );
        expect(
            screen.getByRole('button', { name: '갱신에 실패했어요. 다시 받기' }),
        ).toHaveTextContent('갱신 실패 · 다시 시도');
        rerender(<MyEntryRefreshStatus query={query({ isRateLimited: true })} />);
        expect(screen.getByRole('status')).toHaveTextContent('요청이 많아');
        expect(screen.queryByRole('button')).not.toBeInTheDocument();
    });
});
