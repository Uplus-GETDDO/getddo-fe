import { lazy, Suspense } from 'react';

import { Loading } from '@shared/ui/loading';

import type { GameOverHandler, GameSessionProps } from '../model/types';

import { GameImageButton } from './GameImageButton';

// 게임 엔진·캔버스·에셋 로더는 시작 시점에만 필요하므로 별도 청크로 나눠 유저 번들에서 뺀다
const TakkoRunGame = lazy(() =>
    import('./TakkoRunGame').then((m) => ({ default: m.TakkoRunGame })),
);
const TakkoTimingGame = lazy(() =>
    import('./TakkoTimingGame').then((m) => ({ default: m.TakkoTimingGame })),
);
const ColorWordGame = lazy(() =>
    import('./ColorWordGame').then((m) => ({ default: m.ColorWordGame })),
);
const TakkoOrderGame = lazy(() =>
    import('./TakkoOrderGame').then((m) => ({ default: m.TakkoOrderGame })),
);

/** 게임 코드를 내려받는 동안의 화면 — 게임 영역과 나가기 버튼을 유지해 느린 네트워크에서도 화면이 비거나 갇히지 않게 한다 (모든 게임 공통) */
function GameLoading({ onExit }: { onExit: () => void }) {
    return (
        <div className="bg-surface-page border-fg-primary relative aspect-[840/546] w-full overflow-hidden rounded-2xl border-2 shadow-md">
            <div className="absolute top-2 left-2">
                <GameImageButton kind="exit" size="small" onClick={onExit} />
            </div>
            <Loading label="게임을 불러오는 중이에요" className="h-full" />
        </div>
    );
}

/** 게임 code에 맞는 미니게임 플레이 화면 — 있는지는 hasGamePlayer로 먼저 확인한다 */
export function GamePlayer({
    code,
    session,
    onRestart,
    onRecordingError,
    bestScore,
    onExit,
    onGameOver,
}: GameSessionProps & {
    code: string;
    bestScore?: number;
    onExit: () => void;
    onGameOver?: GameOverHandler;
}) {
    if (code === 'TAKKO_RUN') {
        return (
            <Suspense fallback={<GameLoading onExit={onExit} />}>
                <TakkoRunGame
                    onRecordingError={onRecordingError}
                    session={session}
                    onRestart={onRestart}
                    bestScore={bestScore}
                    onExit={onExit}
                    onGameOver={onGameOver}
                />
            </Suspense>
        );
    }
    if (code === 'COLOR_WORD') {
        return (
            <Suspense fallback={<GameLoading onExit={onExit} />}>
                <ColorWordGame
                    onRecordingError={onRecordingError}
                    session={session}
                    onRestart={onRestart}
                    bestScore={bestScore}
                    onExit={onExit}
                    onGameOver={onGameOver}
                />
            </Suspense>
        );
    }
    if (code === 'TAKKO_TIMING') {
        return (
            <Suspense fallback={<GameLoading onExit={onExit} />}>
                <TakkoTimingGame
                    onRecordingError={onRecordingError}
                    session={session}
                    onRestart={onRestart}
                    bestScore={bestScore}
                    onExit={onExit}
                    onGameOver={onGameOver}
                />
            </Suspense>
        );
    }
    if (code === 'TAKKO_ORDER') {
        return (
            <Suspense fallback={<GameLoading onExit={onExit} />}>
                <TakkoOrderGame
                    onRecordingError={onRecordingError}
                    session={session}
                    onRestart={onRestart}
                    bestScore={bestScore}
                    onExit={onExit}
                    onGameOver={onGameOver}
                />
            </Suspense>
        );
    }
    return null;
}
