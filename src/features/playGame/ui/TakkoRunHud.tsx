import type { Ref } from 'react';

import { AnimatePresence, motion } from 'framer-motion';

import type { RunPhase } from '../model/takkoRun';

import stage1Badge from '../assets/ui/stage/stage-1.png';
import stage2Badge from '../assets/ui/stage/stage-2.png';
import stage3Badge from '../assets/ui/stage/stage-3.png';
import stage4Badge from '../assets/ui/stage/stage-4.png';
import { GameImageButton } from './GameImageButton';
import { ScoreBoard } from './ScoreBoard';
import { StageProgress } from './StageProgress';
import { VolumeControl } from './VolumeControl';

const padScore = (score: number) => String(score).padStart(5, '0');

/** 스테이지 배지 (피그마 image 118) — 번호 - 1이 순서 */
const STAGE_BADGES = [stage1Badge, stage2Badge, stage3Badge, stage4Badge];

/**
 * 타꼬런 HUD — 나가기·소리·일시정지 버튼, 스테이지 배지·배너·진행도, 점수판.
 * 점수·진행도는 값이 바뀔 때만 ref로 화면에 쓴다 (훅이 갱신)
 */
export function TakkoRunHud({
    phase,
    stage,
    stageBanner,
    hasImages,
    level,
    onLevelChange,
    progressRestRef,
    progressFaceRef,
    scoreScope,
    scoreRef,
    onPause,
    onResume,
    onExit,
}: {
    phase: RunPhase;
    stage: number;
    stageBanner: number | null;
    hasImages: boolean;
    level: number;
    onLevelChange: (next: number) => void;
    progressRestRef: Ref<HTMLDivElement>;
    progressFaceRef: Ref<HTMLDivElement>;
    /** 점수 100점마다 반짝이는 애니메이션을 거는 점수판 감쌈 */
    scoreScope: Ref<HTMLDivElement>;
    /** 매 프레임 바뀌는 점수는 다시 그리지 않고 이 요소의 글자만 바꾼다 */
    scoreRef: Ref<HTMLSpanElement>;
    onPause: () => void;
    onResume: () => void;
    onExit: () => void;
}) {
    return (
        <>
            {/* 왼쪽 위 — 나가기(도트 버튼 Small 36)와 그 오른쪽 배경 음악 소리 버튼(image 117, 설정은 이 브라우저에 기억) */}
            {/* 휴대폰처럼 좁은 화면에서는 나가기 아래 줄에 소리·일시정지를 둬 점수판과 겹치지 않게 한다 */}
            <div className="absolute top-3 left-3 flex flex-col items-start gap-2 sm:flex-row sm:gap-3">
                <GameImageButton kind="exit" size="small" onClick={onExit} />
                <div className="flex items-start gap-2 sm:gap-3">
                    <VolumeControl level={level} onLevelChange={onLevelChange} />
                    {/* 일시정지(image 120) — 달리는 동안만, 멈춘 동안 누르면 이어 한다 (Esc·P 키도 같음) */}
                    {(phase === 'running' || phase === 'paused') && (
                        <GameImageButton
                            kind="pause"
                            size="small"
                            onClick={phase === 'paused' ? onResume : onPause}
                        />
                    )}
                </div>
            </div>

            {/* 지금 스테이지 (image 118) — 넓은 화면은 위 가운데, 좁은 화면은 점수판 아래 */}
            {hasImages && (
                <img
                    src={STAGE_BADGES[stage - 1]}
                    alt={`스테이지 ${stage}`}
                    className="absolute top-12 right-3 h-6 w-auto sm:top-3 sm:right-auto sm:left-1/2 sm:h-9 sm:-translate-x-1/2"
                />
            )}

            {/* 스테이지가 오르면 가운데에 크게 톡 튀어나왔다 사라진다 */}
            <div className="pointer-events-none absolute inset-x-0 top-[24%] flex justify-center">
                <AnimatePresence>
                    {stageBanner != null && (
                        <motion.img
                            key={stageBanner}
                            src={STAGE_BADGES[stageBanner - 1]}
                            alt=""
                            initial={{ opacity: 0, scale: 0.4, y: 10 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 1.1, y: -10 }}
                            transition={{ type: 'spring', stiffness: 360, damping: 16 }}
                            className="h-16 w-auto"
                        />
                    )}
                </AnimatePresence>
            </div>

            {/* 스테이지 진행도 — 땅 위 아래쪽 가운데, 타코야끼 얼굴이 1→4 스테이지로 달려간다 */}
            {hasImages && (
                <div className="pointer-events-none absolute inset-x-[14%] bottom-2 rounded-full bg-(--takko-ink)/70 px-5 py-1 sm:inset-x-[22%] sm:bottom-3 sm:px-7 sm:py-1.5">
                    <StageProgress
                        stage={stage}
                        restRef={progressRestRef}
                        faceRef={progressFaceRef}
                    />
                </div>
            )}

            {/* 점수판 (image 112) */}
            <div ref={scoreScope} className="absolute top-3 right-3 origin-top-right">
                <ScoreBoard valueRef={scoreRef} value={padScore(0)} />
            </div>
        </>
    );
}
