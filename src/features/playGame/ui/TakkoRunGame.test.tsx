import { act, render } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';

import type * as TakkoRunAssets from '../model/takkoRunAssets';

import { FixedRun } from '../model/gameSession';
import { TakkoRunGame } from './TakkoRunGame';

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
vi.mock('../model/takkoRunAssets', async (original) => ({
    ...(await original<typeof TakkoRunAssets>()),
    loadTakkoRunImages: () => Promise.resolve({}),
}));
vi.mock('../utils/drawTakkoRun', () => ({ createPalette: () => ({}), drawRun: vi.fn() }));

afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
});
it('긴 프레임 지연을 따라잡지 않고 다음 프레임은 새 시각부터 계산한다', async () => {
    const scrollIntoView = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'scrollIntoView');
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
        configurable: true,
        value: vi.fn(),
    });
    let frame: FrameRequestCallback = () => {};
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
        frame = callback;
        return 1;
    });
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
    vi.stubGlobal('matchMedia', () => ({
        matches: true,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
    }));
    vi.spyOn(performance, 'now').mockReturnValue(0);
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
        setTransform: vi.fn(),
    } as unknown as CanvasRenderingContext2D);
    const advance = vi.spyOn(FixedRun.prototype, 'advance');
    await act(async () => {
        render(
            <TakkoRunGame
                session={{
                    playId: 'test',
                    playToken: 'test',
                    ruleVersion: 'takko-run-v1',
                    startedAt: '2026-10-20T01:00:00Z',
                    rules: { tickMs: 1000 / 120, maxTicks: 72000 },
                    gameData: { generatorVersion: 'takko-run-generator-v1', seed: 1 },
                }}
                onRestart={vi.fn()}
                onRecordingError={vi.fn()}
                onExit={vi.fn()}
            />,
        );
        await Promise.resolve();
    });
    act(() => frame(5000));
    expect(advance).toHaveBeenLastCalledWith(0.1);
    act(() => frame(5016));
    expect(advance).toHaveBeenLastCalledWith(0.016);
    if (scrollIntoView)
        Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', scrollIntoView);
    else Reflect.deleteProperty(HTMLElement.prototype, 'scrollIntoView');
});
