import { type CSSProperties } from 'react';

import type { TakkoRunGameProps } from '../hooks/useTakkoRunGame';

import { useTakkoRunGame } from '../hooks/useTakkoRunGame';
import { isInteractive } from '../utils/isInteractive';
import { TakkoRunHud } from './TakkoRunHud';
import { TakkoRunOverlays, TakkoRunPauseLayer } from './TakkoRunOverlays';

/**
 * 타꼬런 — 타코야끼가 소스병·꼬치를 뛰어넘으며 달리는 미니게임 (크롬 공룡 달리기 방식).
 * 스페이스바·위 화살표나 화면 누르기로 점프하고, 길게 누를수록 높이 뛴다.
 * 게임 대표 영역과 같은 840×546 비율의 캔버스에 그리고, 점수·안내·결과는 그 위에 겹친다.
 * 엔진 루프·키 입력·점수/스테이지 로직은 useTakkoRunGame, HUD·오버레이는 같은 폴더의 TakkoRun* 컴포넌트가 그린다
 */
export function TakkoRunGame(props: TakkoRunGameProps) {
    const { onExit } = props;
    const {
        containerRef,
        canvasRef,
        scoreRef,
        progressRestRef,
        progressFaceRef,
        restartRef,
        runRef,
        assets,
        images,
        loadFailed,
        phase,
        lastScore,
        best,
        newBest,
        stage,
        stageBanner,
        countdown,
        rewardOpen,
        setRewardOpen,
        ticketsGranted,
        rewardGrade,
        shakeScope,
        scoreScope,
        bgm,
        recordInput,
        jump,
        pause,
        startResume,
        restart,
    } = useTakkoRunGame(props);

    return (
        <div
            ref={containerRef}
            tabIndex={-1}
            role="group"
            aria-label="타꼬런 게임"
            // 화면을 누르거나(마우스 클릭·터치) 키보드로 뛴다. 위에 떠 있는 버튼을 누를 때는 뛰지 않는다
            onPointerDown={(event) => {
                if (isInteractive(event.target)) return;
                event.preventDefault();
                if (runRef.current.phase === 'paused') startResume();
                else jump();
            }}
            onPointerUp={() => recordInput('release')}
            onPointerCancel={() => recordInput('release')}
            style={
                assets
                    ? ({
                          '--takko-ink': assets.palette.ground,
                          // 흔들릴 때 가장자리에 드러나는 바탕을 땅 색으로 맞춘다
                          backgroundColor: assets.palette.ground,
                      } as CSSProperties)
                    : undefined
            }
            className="bg-surface-page border-fg-primary @container relative aspect-[840/546] w-full touch-none overflow-hidden rounded-2xl border-2 shadow-md outline-none select-none"
        >
            {/* 부딪히면 이 판이 좌우로 흔들린다 */}
            <div ref={shakeScope} className="absolute inset-0">
                <canvas ref={canvasRef} aria-hidden className="absolute inset-0 size-full" />
            </div>

            <TakkoRunPauseLayer
                phase={phase}
                countdown={countdown}
                hasImages={!!images}
                loadFailed={loadFailed}
            />
            <TakkoRunHud
                phase={phase}
                stage={stage}
                stageBanner={stageBanner}
                hasImages={!!images}
                level={bgm.level}
                onLevelChange={bgm.setLevel}
                progressRestRef={progressRestRef}
                progressFaceRef={progressFaceRef}
                scoreScope={scoreScope}
                scoreRef={scoreRef}
                onPause={pause}
                onResume={startResume}
                onExit={onExit}
            />
            <TakkoRunOverlays
                phase={phase}
                hasImages={!!images}
                lastScore={lastScore}
                best={best}
                newBest={newBest}
                stageBanner={stageBanner}
                rewardOpen={rewardOpen}
                onRewardOpenChange={setRewardOpen}
                ticketsGranted={ticketsGranted}
                rewardGrade={rewardGrade}
                restartRef={restartRef}
                onRestart={restart}
                onExit={onExit}
            />
        </div>
    );
}
