import type { RefObject } from 'react';

import type { TicketGrade } from '@entities/ticket';

import type { ColorWordPhase, ColorWordReveal } from '../hooks/useColorWordGame';

import { GameCountdown } from './GameCountdown';
import { GameKey } from './GameKey';
import {
    GameOverOverlay,
    GamePauseKeysHint,
    GamePauseOverlay,
    GameStartHint,
    GameStartHintLine,
} from './GameOverlays';
import { RewardDialog } from './RewardDialog';

const padScore = (score: number) => String(score).padStart(5, '0');

/**
 * 글자색깔 맞추기의 판 위 화면 — 시작 안내, 3·2·1, 일시정지, 결과, 보상 모달과 스크린리더 안내
 */
export function ColorWordOverlays({
    phase,
    countdown,
    score,
    best,
    newBest,
    reveal,
    wordName,
    inkName,
    rewardOpen,
    onRewardOpenChange,
    ticketsGranted,
    rewardGrade,
    restartRef,
    onStart,
    onResume,
    onExit,
}: {
    phase: ColorWordPhase;
    countdown: number;
    score: number;
    best: number;
    newBest: boolean;
    reveal: ColorWordReveal | null;
    /** 글자 뜻 */
    wordName: string;
    /** 글자에 칠한 색(정답)의 이름 */
    inkName: string;
    rewardOpen: boolean;
    onRewardOpenChange: (open: boolean) => void;
    ticketsGranted: number;
    rewardGrade: TicketGrade | null;
    restartRef: RefObject<HTMLButtonElement | null>;
    onStart: () => void;
    onResume: () => void;
    onExit: () => void;
}) {
    return (
        <>
            {phase === 'ready' && (
                <GameStartHint onStart={onStart}>
                    {/* 조작 — 컴퓨터는 버튼 클릭이나 숫자 키, 터치 기기는 버튼 누르기 */}
                    <GameStartHintLine>
                        <span className="flex items-center gap-1.5 [@media(hover:none)]:hidden">
                            클릭 또는 <GameKey>1</GameKey>~<GameKey>4</GameKey> 색 고르기
                        </span>
                        <span className="hidden [@media(hover:none)]:inline">
                            버튼을 눌러 색 고르기
                        </span>
                        <GamePauseKeysHint />
                    </GameStartHintLine>
                    <GameStartHintLine>목숨 3개 · 맞힐수록 빨라져요</GameStartHintLine>
                </GameStartHint>
            )}

            {/* 3, 2, 1 */}
            {phase === 'countdown' && (
                <div className="bg-surface-inverse/40 absolute inset-0 flex items-center justify-center">
                    <GameCountdown value={countdown} />
                </div>
            )}

            {phase === 'paused' && <GamePauseOverlay onResume={onResume} />}

            {phase === 'over' && (
                <GameOverOverlay
                    title="목숨을 다 썼어요!"
                    score={padScore(score)}
                    best={best}
                    newBest={newBest}
                    onRetry={onStart}
                    onExit={onExit}
                    retryRef={restartRef}
                />
            )}

            <RewardDialog
                open={rewardOpen}
                onOpenChange={onRewardOpenChange}
                onClosed={() => restartRef.current?.focus()}
                tickets={ticketsGranted}
                grade={rewardGrade}
            />

            {/* 스크린리더 — 문제와 결과를 알린다 */}
            <p aria-live="polite" className="sr-only">
                {phase === 'playing' && !reveal ? `${inkName}색으로 쓴 ${wordName}` : ''}
                {reveal
                    ? reveal.ok
                        ? '정답'
                        : reveal.picked === null
                          ? '시간 초과'
                          : `틀렸어요. 정답은 ${inkName}`
                    : ''}
                {phase === 'paused' ? '일시정지' : ''}
                {phase === 'over' ? `게임 끝. ${score}점` : ''}
            </p>
        </>
    );
}
