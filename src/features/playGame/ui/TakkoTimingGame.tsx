import type { TakkoTimingGameProps, TakkoTimingReveal } from '../hooks/useTakkoTimingGame';

import background from '../assets/takkoTiming/background.jpg';
import { useTakkoTimingGame } from '../hooks/useTakkoTimingGame';
import { GameImageButton } from './GameImageButton';
import { GameRewardProgress } from './GameRewardProgress';
import { ScoreBoard } from './ScoreBoard';
import { TakkoTimingBoard } from './TakkoTimingBoard';
import { TakkoTimingOverlays } from './TakkoTimingOverlays';
import { VolumeControl } from './VolumeControl';

const padScore = (score: number) => String(score).padStart(5, '0');

/** 결과 말풍선 — 퍼펙트는 연속이면 횟수를, 빗나가면 이른지 늦은지를 알려 '아깝다'를 느끼게 한다 */
const resultChip = (reveal: TakkoTimingReveal) =>
    reveal.result === 'perfect'
        ? reveal.streak >= 2
            ? `퍼펙트 ×${reveal.streak}! +20`
            : '퍼펙트! +20'
        : reveal.result === 'hit'
          ? '콕! +10'
          : reveal.miss === 'early'
            ? '조금 빨랐어요!'
            : '조금 늦었어요!';

/**
 * 타꼬 타이밍 맞추기 — 금색 구간에 서 있는 타꼬 위를 이쑤시개가 좌우로 오가고, 타꼬 위에 왔을 때 콕 꽂는다 (화면 클릭·터치, 스페이스바·Enter).
 * 상태·타이머·판정은 useTakkoTimingGame, 게이지 장면·오버레이는 같은 폴더의 TakkoTiming* 컴포넌트가 그린다
 */
export function TakkoTimingGame(props: TakkoTimingGameProps) {
    const { session, onExit } = props;
    const {
        phase,
        countdown,
        round,
        roundKey,
        score,
        reveal,
        speedNotice,
        best,
        newBest,
        rewardOpen,
        setRewardOpen,
        ticketsGranted,
        rewardGrade,
        boardScope,
        restartRef,
        runnerX,
        bgm,
        start,
        judge,
        pause,
        resume,
    } = useTakkoTimingGame(props);

    const chip = reveal ? resultChip(reveal) : null;

    return (
        <div
            // 판 배경 — 피그마 image 188 (타코야끼 가게 카운터). 그림과 같은 16:9로 둬서 양쪽 소품이 잘리지 않게 한다
            className="border-fg-primary @container relative aspect-video w-full overflow-hidden rounded-2xl border-2 bg-cover bg-center shadow-md select-none"
            style={{ backgroundImage: `url(${background})` }}
        >
            {/* 보상 기준까지 남은 점수 — 장면보다 먼저 그려 결과 말풍선이 위로 지나가게 한다 */}
            {phase !== 'ready' && (
                <GameRewardProgress score={score} goal={session.rules.minimumRewardScore!} />
            )}

            <TakkoTimingBoard
                boardScope={boardScope}
                phase={phase}
                round={round}
                roundKey={roundKey}
                reveal={reveal}
                chip={chip}
                runnerX={runnerX}
                onJudge={judge}
            />

            {/* 위 — 나가기·소리·일시정지 · 점수판. 아래 장면을 누를 수 있게 빈 곳은 누름을 통과시킨다 */}
            <div className="pointer-events-none absolute inset-0 flex flex-col">
                {/* 멈춤·세기 화면 위에서도 누를 수 있게 앞에 둔다 */}
                <div
                    className={`pointer-events-auto flex items-start justify-between gap-3 p-3 ${phase === 'over' ? '' : 'relative z-10'}`}
                >
                    <div className="flex items-start gap-2 sm:gap-3">
                        <GameImageButton kind="exit" size="small" onClick={onExit} />
                        <VolumeControl level={bgm.level} onLevelChange={bgm.setLevel} />
                        {(phase === 'playing' || phase === 'countdown' || phase === 'paused') && (
                            <GameImageButton
                                kind="pause"
                                size="small"
                                onClick={phase === 'paused' ? resume : pause}
                            />
                        )}
                    </div>
                    <ScoreBoard value={padScore(score)} />
                </div>
            </div>

            <TakkoTimingOverlays
                phase={phase}
                roundKey={roundKey}
                countdown={countdown}
                speedNotice={speedNotice}
                reveal={reveal}
                chip={chip}
                score={score}
                best={best}
                newBest={newBest}
                rewardOpen={rewardOpen}
                onRewardOpenChange={setRewardOpen}
                ticketsGranted={ticketsGranted}
                rewardGrade={rewardGrade}
                restartRef={restartRef}
                onStart={start}
                onResume={resume}
                onExit={onExit}
            />
        </div>
    );
}
