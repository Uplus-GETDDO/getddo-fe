import { act, fireEvent, render, screen, cleanup } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { TakkoOrderGame } from './TakkoOrderGame';

vi.mock('../hooks/useLoopingBgm', () => ({
    useLoopingBgm: () => ({
        play: vi.fn(),
        duck: vi.fn(),
        pause: vi.fn(),
        resume: vi.fn(),
        playEffect: vi.fn(),
        preloadEffects: vi.fn(),
        level: 0,
        setLevel: vi.fn(),
    }),
}));
const session = {
    playId: '0199f000-0000-7000-8000-000000000104',
    playToken: 'test-token',
    ruleVersion: 'takko-order-v1',
    startedAt: '2026-10-20T01:00:00Z',
    rules: { initialLives: 3, startLength: 3, maxLength: 8 },
    gameData: { generatorVersion: 'takko-order-generator-v1', seed: 1 },
};
const advance = async (ms: number) => {
    await act(async () => {
        await vi.advanceTimersByTimeAsync(ms);
    });
};
beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'performance'] });
    vi.stubGlobal('matchMedia', () => ({
        matches: true,
        addEventListener: () => {},
        removeEventListener: () => {},
    }));
});
afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
});
describe('주문 결과 표시 중 정지', () => {
    it.each(['hidden', 'blur', 'button', 'Space', 'Enter'])(
        '%s에서 다음 주문을 숨겨진 채 진행하지 않는다',
        async (trigger) => {
            const onGameOver = vi.fn();
            render(
                <TakkoOrderGame
                    session={session}
                    onRestart={vi.fn()}
                    onRecordingError={vi.fn()}
                    onExit={vi.fn()}
                    onGameOver={onGameOver}
                />,
            );
            fireEvent.click(screen.getByRole('button', { name: '게임 시작' }));
            for (let count = 0; count < 3; count++) await advance(700);
            await advance(2600);
            const pick = screen.getByRole('button', { name: '2번 치즈 내주기' });
            expect(pick).toBeEnabled();
            fireEvent.click(pick);
            if (trigger === 'hidden') {
                vi.spyOn(document, 'hidden', 'get').mockReturnValue(true);
                fireEvent(document, new Event('visibilitychange'));
            } else if (trigger === 'blur') fireEvent(window, new Event('blur'));
            else fireEvent.click(screen.getByRole('button', { name: '일시정지' }));
            expect(screen.getByRole('button', { name: '이어 하기' })).toBeInTheDocument();
            await advance(10000);
            expect(pick).toBeDisabled();
            expect(onGameOver).not.toHaveBeenCalled();
            if (trigger === 'Space' || trigger === 'Enter') {
                fireEvent.keyDown(window, {
                    key: trigger === 'Space' ? ' ' : 'Enter',
                    code: trigger,
                });
            } else fireEvent.click(screen.getByRole('button', { name: '이어 하기' }));
            await advance(1600);
            expect(pick).toBeDisabled();
            await advance(2599);
            expect(pick).toBeDisabled();
            await advance(1);
            expect(pick).toBeEnabled();
        },
    );
});
