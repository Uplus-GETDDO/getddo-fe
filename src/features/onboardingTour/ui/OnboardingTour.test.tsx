import { act, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useSessionStore } from '@entities/user';

import { OnboardingTour } from './OnboardingTour';

const drive = vi.fn();
const destroy = vi.fn();
vi.mock('driver.js', () => ({ driver: () => ({ drive, destroy }) }));

const signIn = (id: string) =>
    useSessionStore.setState({
        user: { id, name: '테스트', role: 'USER', membership: 'vip', personaLabel: null },
    });

describe('홈 첫 방문 안내', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        localStorage.clear();
        drive.mockClear();
    });
    afterEach(() => {
        vi.useRealTimers();
        useSessionStore.setState({ user: null });
    });

    it('사용자마다 처음 한 번만 시작한다', async () => {
        signIn('u-1');
        const first = render(<OnboardingTour ready />);
        await act(() => vi.runAllTimers());
        expect(drive).toHaveBeenCalledTimes(1);
        first.unmount();

        render(<OnboardingTour ready />);
        await act(() => vi.runAllTimers());
        expect(drive).toHaveBeenCalledTimes(1);

        await act(() => signIn('u-2'));
        await act(() => vi.runAllTimers());
        expect(drive).toHaveBeenCalledTimes(2);
    });

    it('화면이 준비되기 전이나 시작 전에 떠나면 띄우지 않고 본 것으로 적지도 않는다', async () => {
        signIn('u-1');
        const { rerender, unmount } = render(<OnboardingTour ready={false} />);
        await act(() => vi.runAllTimers());
        expect(drive).not.toHaveBeenCalled();

        rerender(<OnboardingTour ready />);
        unmount();
        await act(() => vi.runAllTimers());
        expect(drive).not.toHaveBeenCalled();

        render(<OnboardingTour ready />);
        await act(() => vi.runAllTimers());
        expect(drive).toHaveBeenCalledTimes(1);
    });
});
