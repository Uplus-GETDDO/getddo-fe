import type { RefObject } from 'react';

import type { TicketGrade } from '@entities/ticket';

import type { TakkoOrderPhase } from '../hooks/useTakkoOrderGame';
import type { TakkoOrderItemId } from '../model/takkoOrder';

import { TAKKO_ORDER_MENU } from '../model/takkoOrder';
import { GameCountdown } from './GameCountdown';
import { GameKey } from './GameKey';
import {
    GameOverOverlay,
    GamePauseOverlay,
    GameStartHint,
    GameStartHintLine,
} from './GameOverlays';
import { RewardDialog } from './RewardDialog';

const padScore = (score: number) => String(score).padStart(5, '0');
const nameOf = (id: TakkoOrderItemId) => TAKKO_ORDER_MENU.find((item) => item.id === id)!.name;

/**
 * 타꼬 주문의 판 위 화면 — 맞힘·틀림 테두리, 시작 안내, 3·2·1, 일시정지, 결과, 보상 모달과 스크린리더 안내
 */
export function TakkoOrderOverlays({
    phase,
    ok,
    countdown,
    score,
    best,
    newBest,
    order,
    pickedCount,
    rewardOpen,
    onRewardOpenChange,
    ticketsGranted,
    rewardGrade,
    restartRef,
    onStart,
    onResume,
    onExit,
}: {
    phase: TakkoOrderPhase;
    ok: boolean;
    countdown: number;
    score: number;
    best: number;
    newBest: boolean;
    order: TakkoOrderItemId[];
    pickedCount: number;
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
            {/* 맞힘·틀림 — 게임 판 테두리를 초록·빨강으로 잠깐 바꾼다 */}
            {phase === 'reveal' && (
                <div
                    aria-hidden
                    className={`pointer-events-none absolute inset-0 rounded-[inherit] border-4 ${ok ? 'border-semantic-success' : 'border-semantic-error'}`}
                />
            )}

            {phase === 'ready' && (
                <GameStartHint onStart={onStart}>
                    <GameStartHintLine>
                        <span className="flex items-center gap-1.5 [@media(hover:none)]:hidden">
                            주문을 외웠다가 클릭 또는 <GameKey>1</GameKey>~<GameKey>4</GameKey>로
                            내주기 · <GameKey>Backspace</GameKey> 지우기
                        </span>
                        <span className="hidden [@media(hover:none)]:inline">
                            주문을 외웠다가 버튼을 순서대로 누르기
                        </span>
                    </GameStartHintLine>
                    <GameStartHintLine>
                        다 내면 판정 · 목숨 3개 · 맞힐수록 주문이 길어져요
                    </GameStartHintLine>
                </GameStartHint>
            )}

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

            {/* 스크린리더 — 주문과 결과를 알린다 */}
            <p aria-live="polite" className="sr-only">
                {phase === 'showing' ? `주문: ${order.map(nameOf).join(', ')}` : ''}
                {phase === 'input' ? `${pickedCount + 1}번째를 골라 주세요` : ''}
                {phase === 'reveal'
                    ? ok
                        ? '맞았어요'
                        : `틀렸어요. 주문은 ${order.map(nameOf).join(', ')}`
                    : ''}
                {phase === 'over' ? `게임 끝. ${score}점` : ''}
            </p>
        </>
    );
}
