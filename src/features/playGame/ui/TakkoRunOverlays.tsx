import type { RefObject } from 'react';

import { motion } from 'framer-motion';

import type { TicketGrade } from '@entities/ticket';

import { Loading } from '@shared/ui/loading';
import { formatNumber } from '@shared/utils/format';

import type { RunPhase } from '../model/takkoRun';

import newBadge from '../assets/ui/badge-new.png';
import { GameCountdown } from './GameCountdown';
import { GameImageButton } from './GameImageButton';
import { GameKey } from './GameKey';
import { RewardDialog } from './RewardDialog';
import { ScoreBoard } from './ScoreBoard';

const padScore = (score: number) => String(score).padStart(5, '0');

/**
 * 게임 위에 떠 있는 안내 칩 — 마을 실루엣에서 뽑은 짙은 갈색(--takko-ink)을 반투명하게 깔아 노을 배경과 어우러지게 한다
 */
const HUD_CHIP = 'bg-(--takko-ink)/55 text-fg-on-brand rounded-lg backdrop-blur-sm';

/**
 * 일시정지 화면과 불러오기 상태 — 위에 떠 있는 버튼은 그대로 누를 수 있게 버튼보다 아래에 깐다.
 * HUD보다 먼저(DOM에서 앞에) 그려야 버튼이 가려지지 않는다
 */
export function TakkoRunPauseLayer({
    phase,
    countdown,
    hasImages,
    loadFailed,
}: {
    phase: RunPhase;
    /** 일시정지를 풀기 전 남은 카운트다운 (없으면 null) */
    countdown: number | null;
    hasImages: boolean;
    loadFailed: boolean;
}) {
    return (
        <>
            {phase === 'paused' && (
                <div className="absolute inset-0 flex items-center justify-center bg-(--takko-ink)/50 px-6 backdrop-blur-[2px]">
                    {countdown != null ? (
                        <GameCountdown value={countdown} />
                    ) : (
                        <div className="flex flex-col items-center gap-3 text-center">
                            <p className="text-title-3 text-ticket-accent">일시정지</p>
                            <p className="text-body-sm text-ticket-accent flex flex-wrap items-center justify-center gap-1">
                                <span className="flex items-center gap-1 [@media(hover:none)]:hidden">
                                    <GameKey>Space</GameKey>
                                    <span className="ml-0.5">또는</span>
                                </span>
                                화면을 눌러 계속하기
                            </p>
                        </div>
                    )}
                </div>
            )}

            {!hasImages &&
                (loadFailed ? (
                    <p className="text-body-sm text-fg-tertiary absolute inset-0 flex items-center justify-center">
                        게임을 불러오지 못했어요.
                    </p>
                ) : (
                    <Loading label="게임을 불러오는 중이에요" className="absolute inset-0" />
                ))}
        </>
    );
}

/**
 * 타꼬런 판 위 화면 — 시작 안내, 게임 끝 결과, 보상 모달과 스크린리더 안내.
 * HUD 위에 뜨므로 HUD 다음(DOM에서 뒤에)에 그린다
 */
export function TakkoRunOverlays({
    phase,
    hasImages,
    lastScore,
    best,
    newBest,
    stageBanner,
    rewardOpen,
    onRewardOpenChange,
    ticketsGranted,
    rewardGrade,
    restartRef,
    onRestart,
    onExit,
}: {
    phase: RunPhase;
    hasImages: boolean;
    lastScore: number;
    best: number;
    newBest: boolean;
    stageBanner: number | null;
    rewardOpen: boolean;
    onRewardOpenChange: (open: boolean) => void;
    ticketsGranted: number;
    rewardGrade: TicketGrade | null;
    restartRef: RefObject<HTMLButtonElement | null>;
    onRestart: () => void;
    onExit: () => void;
}) {
    return (
        <>
            {/* 시작 안내 — 조작키와 짧게·길게 점프. 위치는 다른 게임의 공용 시작 안내(GameStartHint)와 같다 */}
            {hasImages && phase === 'ready' && (
                <div className="pointer-events-none absolute inset-x-0 top-[42%] flex justify-center px-4 sm:top-[22%] sm:px-6">
                    <div
                        className={`${HUD_CHIP} flex flex-col items-center gap-2 rounded-2xl px-4 py-3 text-center sm:gap-3 sm:px-6 sm:py-4`}
                    >
                        <p className="text-body-bold sm:text-subhead flex flex-wrap items-center justify-center gap-2">
                            {/* 컴퓨터는 스페이스바·↑ 키와 화면 클릭, 터치 기기(마우스 올리기 없음)는 화면 누르기로 안내한다 */}
                            <span className="flex items-center gap-1 [@media(hover:none)]:hidden">
                                <GameKey className="motion-safe:animate-pulse">Space</GameKey>
                                <GameKey className="motion-safe:animate-pulse">↑</GameKey>
                                <span className="ml-1">또는 화면을 눌러 시작</span>
                            </span>
                            <span className="hidden [@media(hover:none)]:inline">
                                화면을 눌러 시작
                            </span>
                        </p>
                        <p className="text-caption sm:text-body-sm flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5">
                            <span className="flex items-center gap-1.5">
                                <GameKey>짧게</GameKey> 낮게 점프
                            </span>
                            <span className="flex items-center gap-1.5">
                                <GameKey>길게</GameKey> 높게 점프
                            </span>
                        </p>
                    </div>
                </div>
            )}

            {phase === 'over' && (
                <div className="absolute inset-0 flex items-center justify-center bg-(--takko-ink)/60 px-6">
                    <div className="flex flex-col items-center gap-5 text-center">
                        <p className="text-title-3 text-ticket-accent">앗, 부딪혔어요!</p>
                        <div className="flex flex-col items-center gap-2">
                            <div className="relative">
                                <ScoreBoard value={padScore(lastScore)} size="large" />
                                {/* 최고 기록이면 점수판 오른쪽 위에 NEW 배지(피그마 image 113)가 톡 붙는다 */}
                                {newBest && (
                                    <motion.img
                                        src={newBadge}
                                        alt="최고 기록"
                                        initial={{ opacity: 0, scale: 0.4, rotate: -20 }}
                                        animate={{ opacity: 1, scale: 1, rotate: 8 }}
                                        transition={{
                                            type: 'spring',
                                            stiffness: 420,
                                            damping: 14,
                                            delay: 0.15,
                                        }}
                                        className="absolute -top-4 -right-7 h-7 w-auto"
                                    />
                                )}
                            </div>
                            <p className="text-body-sm text-ticket-accent">
                                {newBest
                                    ? `최고 점수 ${formatNumber(best)}점을 기록했어요.`
                                    : `최고 점수 ${formatNumber(best)}점`}
                            </p>
                        </div>
                        <div className="mt-1 flex items-center gap-4">
                            <GameImageButton kind="retry" onClick={onRestart} ref={restartRef} />
                            <GameImageButton kind="exit" onClick={onExit} />
                        </div>
                    </div>
                </div>
            )}

            {/* 닫으면 초점을 다시 '다시 하기'로 돌려 스페이스바로 바로 이어 할 수 있게 한다 */}
            <RewardDialog
                open={rewardOpen}
                onOpenChange={onRewardOpenChange}
                onClosed={() => restartRef.current?.focus()}
                tickets={ticketsGranted}
                grade={rewardGrade}
            />

            <p aria-live="polite" className="sr-only">
                {phase === 'over' ? `게임 끝. ${lastScore}점` : ''}
                {stageBanner != null ? `스테이지 ${stageBanner}` : ''}
            </p>
        </>
    );
}
