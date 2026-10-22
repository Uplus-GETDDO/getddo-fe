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
            // 주문 3개를 다 내야 판정한다 — 같은 메뉴가 세 번 연달아 나오는 주문은 없어 치즈 셋은 늘 틀린다
            for (let count = 0; count < 3; count++) fireEvent.click(pick);
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
describe('틀려도 끝까지 내주기', () => {
    it('중간에 틀려도 주문 개수만큼 낸 뒤에 판정하고, 기록은 처음 틀린 메뉴까지만 남긴다', async () => {
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
        for (let round = 0; round < 3; round++) {
            await advance(2600);
            const pick = screen.getByRole('button', { name: '2번 치즈 내주기' });
            fireEvent.click(pick);
            fireEvent.click(pick);
            expect(pick).toBeEnabled();
            fireEvent.click(pick);
            expect(pick).toBeDisabled();
            await advance(1600);
        }
        expect(onGameOver).toHaveBeenCalledTimes(1);
        const { rounds } = onGameOver.mock.calls[0]![1] as {
            rounds: { sequence: number; picks: string[] }[];
        };
        expect(rounds).toHaveLength(3);
        for (const round of rounds) {
            expect(round.picks).toEqual(['cheese']);
        }
    });
});

describe('판정 전 지우기', () => {
    it('잘못 낸 메뉴를 Backspace로 지우고 다시 내면 맞힌 주문으로 기록한다', async () => {
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
        // 보여 주는 동안 화면 낭독기 문구에서 주문을 읽는다
        const names = { 파: 1, 치즈: 2, 새우: 3, 김: 4 } as const;
        const order = screen
            .getByText(/^주문:/)
            .textContent.replace('주문: ', '')
            .split(', ') as (keyof typeof names)[];
        await advance(2600);
        const press = (key: string) => fireEvent.keyDown(window, { key });
        const wrong = names[order[0]!] === 1 ? '2' : '1';
        press(wrong);
        expect(screen.getByRole('button', { name: '마지막으로 낸 메뉴 지우기' })).toBeEnabled();
        press('Backspace');
        expect(screen.getByRole('button', { name: '마지막으로 낸 메뉴 지우기' })).toBeDisabled();
        for (const name of order) press(String(names[name]));
        expect(screen.getByText('맞았어요')).toBeInTheDocument();
    });
});
