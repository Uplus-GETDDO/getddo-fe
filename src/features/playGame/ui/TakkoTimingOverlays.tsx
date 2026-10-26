import type { RefObject } from 'react';

import { motion } from 'framer-motion';

import type { TicketGrade } from '@entities/ticket';

import type { TakkoTimingPhase, TakkoTimingReveal } from '../hooks/useTakkoTimingGame';

import { PIXEL_FONT } from '../model/pixelFont';
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
 * 타꼬 타이밍의 판 위 화면 — '속도 UP!' 알림, 성공·실패 테두리, 시작 안내, 3·2·1, 일시정지, 결과, 보상 모달과 스크린리더 안내
 */
export function TakkoTimingOverlays({
    phase,
    roundKey,
    countdown,
    speedNotice,
    reveal,
    chip,
    score,
    best,
    newBest,
    rewardOpen,
    onRewardOpenChange,
    ticketsGranted,
    rewardGrade,
    restartRef,
    onStart,
    onResume,
    onExit,
}: {
    phase: TakkoTimingPhase;
    roundKey: number;
    countdown: number;
    speedNotice: { roundKey: number; text: string } | null;
    reveal: TakkoTimingReveal | null;
    chip: string | null;
    score: number;
    best: number;
    newBest: boolean;
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
            {/* 빨라진 판 시작 알림 — 위쪽 가운데에 잠깐 톡 뜬다 */}
            {speedNotice?.roundKey === roundKey && phase === 'playing' && (
                <motion.span
                    key={`speed-${roundKey}`}
                    aria-hidden
                    initial={{ opacity: 0, y: 8, scale: 0.8 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ type: 'spring', stiffness: 460, damping: 18 }}
                    className={`border-fg-primary bg-ticket-primary text-fg-primary pointer-events-none absolute top-[24%] left-1/2 z-20 -translate-x-1/2 rounded-md border-[3px] px-3 py-1 text-sm whitespace-nowrap shadow-[3px_3px_0_0_var(--color-fg-primary)] @lg:text-lg ${PIXEL_FONT}`}
                >
                    {speedNotice.text}
                </motion.span>
            )}

            {/* 성공·실패 — 게임 판 테두리를 초록·빨강으로 잠깐 바꾼다 */}
            {reveal && (
                <div
                    aria-hidden
                    className={`pointer-events-none absolute inset-0 rounded-[inherit] border-4 ${reveal.points > 0 ? 'border-semantic-success' : 'border-semantic-error'}`}
                />
            )}

            {phase === 'ready' && (
                <GameStartHint onStart={onStart}>
                    <GameStartHintLine>
                        <span className="flex items-center gap-1.5 [@media(hover:none)]:hidden">
                            화면 클릭 또는 <GameKey>Space</GameKey> 꽂기
                        </span>
                        <span className="hidden [@media(hover:none)]:inline">화면을 눌러 꽂기</span>
                        <GamePauseKeysHint />
                    </GameStartHintLine>
                    {/* 점수 규칙(퍼펙트 2배 등)은 게임 방법에 두고, 여기에는 시작 전에 꼭 알아야 할 것만 둔다 */}
                    <GameStartHintLine>한 번 빗나가면 끝!</GameStartHintLine>
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
                    title="빗나갔어요!"
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

            {/* 스크린리더 — 결과를 알린다 */}
            <p aria-live="polite" className="sr-only">
                {phase === 'playing' && !reveal
                    ? '이쑤시개가 움직여요. 타꼬 위에 오면 꽂으세요'
                    : ''}
                {chip ?? ''}
                {phase === 'paused' ? '일시정지' : ''}
                {phase === 'over' ? `게임 끝. ${score}점` : ''}
            </p>
        </>
    );
}
