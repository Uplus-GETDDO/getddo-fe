import type { ReactNode, Ref } from 'react';

import { motion } from 'framer-motion';

import { formatNumber } from '@shared/utils/format';

import heartEmpty from '../assets/colorWord/heart-empty.png';
import heartFull from '../assets/colorWord/heart-full.png';
import { GameImageButton } from './GameImageButton';
import { GameKey } from './GameKey';
import { ScoreBoard } from './ScoreBoard';

/*
 * 목숨제 미니게임(글자색깔 맞추기·타꼬 타이밍 맞추기)이 같이 쓰는 판 위 화면 조각 —
 * 목숨 하트, 시작 안내, 일시정지, 게임 끝
 */

/** 위쪽 정가운데 목숨 하트(피그마 image 176) — 왼쪽 버튼 수(일시정지가 생기고 사라짐)와 상관없이 흔들리지 않게 따로 고정한다 */
export function GameLives({ lives, max }: { lives: number; max: number }) {
    return (
        <div
            aria-label={`남은 목숨 ${lives}개`}
            className="absolute top-3 left-1/2 flex -translate-x-1/2 items-center gap-1 pt-1"
        >
            {Array.from({ length: max }, (_, index) => (
                <motion.img
                    key={index}
                    src={index < lives ? heartFull : heartEmpty}
                    alt=""
                    draggable={false}
                    animate={{ scale: index < lives ? 1 : 0.85 }}
                    transition={{ type: 'spring', stiffness: 420, damping: 18 }}
                    // 그림 비율(가로 625 : 세로 492)을 그대로 두고 너비만 정한다
                    className="h-auto w-5 [image-rendering:pixelated] sm:w-6"
                />
            ))}
        </div>
    );
}

/**
 * 시작 안내 — 따로 시작 버튼 없이 키나 판을 누르면 바로 시작한다 (게임 상세의 '게임 시작'과 겹치지 않게).
 * 판 전체가 누를 수 있는 버튼이다. 첫 줄(시작 방법)은 공통이고, 아래 줄(조작·규칙)은 게임마다 넘긴다
 */
export function GameStartHint({ onStart, children }: { onStart: () => void; children: ReactNode }) {
    return (
        <button
            type="button"
            onClick={onStart}
            aria-label="게임 시작"
            className="focus-visible:ring-border-focus absolute inset-0 cursor-pointer focus-visible:ring-2 focus-visible:outline-none focus-visible:ring-inset"
        >
            {/* 세 게임(타꼬런·글자색깔 맞추기·타꼬 타이밍)이 같은 자리에 안내를 띄운다 — 휴대폰은 위쪽 버튼 줄 아래(42%), 넓은 화면은 22% */}
            <span className="absolute inset-x-0 top-[42%] flex justify-center px-4 sm:top-[22%] sm:px-6">
                <span className="bg-surface-inverse/55 text-fg-on-brand flex flex-col items-center gap-2 rounded-2xl px-4 py-3 text-center backdrop-blur-sm sm:gap-3 sm:px-6 sm:py-4">
                    <span className="text-body-bold sm:text-subhead flex flex-wrap items-center justify-center gap-2">
                        {/* 컴퓨터는 스페이스바·Enter와 화면 클릭, 터치 기기(마우스 올리기 없음)는 화면 누르기로 안내한다 */}
                        <span className="flex items-center gap-1 [@media(hover:none)]:hidden">
                            <GameKey className="motion-safe:animate-pulse">Space</GameKey>
                            <GameKey className="motion-safe:animate-pulse">Enter</GameKey>
                            <span className="ml-1">또는 화면을 눌러 시작</span>
                        </span>
                        <span className="hidden [@media(hover:none)]:inline">화면을 눌러 시작</span>
                    </span>
                    {children}
                </span>
            </span>
        </button>
    );
}

/** 시작 안내의 한 줄 — 글자 크기·간격을 맞춘다 */
export function GameStartHintLine({ children }: { children: ReactNode }) {
    return (
        <span className="text-caption sm:text-body-sm flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5">
            {children}
        </span>
    );
}

/** 시작 안내의 일시정지 키 안내 (터치 기기에서는 숨긴다) */
export function GamePauseKeysHint() {
    return (
        <span className="flex items-center gap-1.5 [@media(hover:none)]:hidden">
            <GameKey>Esc</GameKey>·<GameKey>P</GameKey> 일시정지
        </span>
    );
}

/** 일시정지 — 판을 누르거나 스페이스바·Enter·Esc·P로 이어 한다 */
export function GamePauseOverlay({ onResume }: { onResume: () => void }) {
    return (
        <button
            type="button"
            onClick={onResume}
            aria-label="이어 하기"
            className="bg-surface-inverse/60 absolute inset-0 flex cursor-pointer flex-col items-center justify-center gap-3 px-6 text-center backdrop-blur-sm"
        >
            <span className="text-title-3 text-ticket-accent">일시정지</span>
            <span className="text-body-sm text-ticket-accent flex flex-wrap items-center justify-center gap-1">
                <span className="flex items-center gap-1 [@media(hover:none)]:hidden">
                    <GameKey>Space</GameKey>
                    <span className="ml-0.5">또는</span>
                </span>
                화면을 눌러 계속하기
            </span>
        </button>
    );
}

/** 게임 끝 — 점수·최고 점수와 다시 하기·나가기 */
export function GameOverOverlay({
    title,
    score,
    best,
    newBest,
    onRetry,
    onExit,
    retryRef,
}: {
    title: string;
    /** 점수판에 보일 글자 (자릿수를 채운 점수) */
    score: string;
    best: number;
    newBest: boolean;
    onRetry: () => void;
    onExit: () => void;
    retryRef?: Ref<HTMLButtonElement>;
}) {
    return (
        <div className="bg-surface-inverse/60 absolute inset-0 flex items-center justify-center px-6">
            <div className="flex flex-col items-center gap-5 text-center">
                <p className="text-title-3 text-ticket-accent">{title}</p>
                <div className="flex flex-col items-center gap-2">
                    <ScoreBoard value={score} size="large" />
                    <p className="text-body-sm text-ticket-accent">
                        {newBest
                            ? `최고 점수 ${formatNumber(best)}점을 기록했어요.`
                            : `최고 점수 ${formatNumber(best)}점`}
                    </p>
                </div>
                <div className="mt-1 flex items-center gap-4">
                    <GameImageButton kind="retry" onClick={onRetry} ref={retryRef} />
                    <GameImageButton kind="exit" onClick={onExit} />
                </div>
            </div>
        </div>
    );
}
