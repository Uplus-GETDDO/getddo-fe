import type { ColorWordGameProps } from '../hooks/useColorWordGame';

import background from '../assets/colorWord/background.jpg';
import { useColorWordGame } from '../hooks/useColorWordGame';
import { COLOR_WORD_LIVES } from '../model/colorWord';
import { ColorWordBoard } from './ColorWordBoard';
import { ColorWordOverlays } from './ColorWordOverlays';
import { ColorWordResult } from './ColorWordResult';
import { GameImageButton } from './GameImageButton';
import { GameLives } from './GameOverlays';
import { GameTimer } from './GameTimer';
import { ScoreBoard } from './ScoreBoard';
import { VolumeControl } from './VolumeControl';

const padScore = (score: number) => String(score).padStart(5, '0');

/**
 * 글자색깔 맞추기 — 글자 뜻이 아니라 글자에 칠해진 색 버튼을 누른다 (키보드 1~4도 된다).
 * 답을 고르면 타코야끼 표정·판 테두리·결과 칩으로 맞음·틀림을 잠깐 보여 준다.
 * 상태·타이머·판정은 useColorWordGame, 글자판·결과 표시·오버레이는 같은 폴더의 ColorWord* 컴포넌트가 그린다
 */
export function ColorWordGame(props: ColorWordGameProps) {
    const { onExit } = props;
    const {
        phase,
        countdown,
        roundKey,
        score,
        lives,
        reveal,
        hurry,
        timeLeft,
        word,
        ink,
        best,
        newBest,
        rewardOpen,
        setRewardOpen,
        ticketsGranted,
        rewardGrade,
        boardScope,
        restartRef,
        bgm,
        start,
        judge,
        pause,
        resume,
    } = useColorWordGame(props);

    return (
        <div
            // 판 배경 — 피그마 image 175 (노을 하늘과 구름 위 타코야끼)
            className="border-fg-primary @container relative aspect-[840/546] w-full overflow-hidden rounded-2xl border-2 bg-cover bg-center shadow-md select-none"
            style={{ backgroundImage: `url(${background})` }}
        >
            <div className="absolute inset-0 flex flex-col">
                {/* 위 — 나가기·소리·일시정지 · 목숨(image 176) · 점수판. 멈춤·세기 화면 위에서도 누를 수 있게 앞에 둔다 */}
                <div
                    className={`flex items-start justify-between gap-3 p-3 ${phase === 'over' ? '' : 'relative z-10'}`}
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
                    <GameLives lives={lives} max={COLOR_WORD_LIVES} />
                    <ScoreBoard value={padScore(score)} />
                </div>

                {/* 시간 게이지 — 타코야끼가 남은 시간 끝에 붙어 함께 줄고, 1/3 이하로 남으면 빨개진다 */}
                <div className="mx-6">
                    <GameTimer timeLeft={timeLeft} hurry={hurry && phase !== 'ready'} />
                </div>

                <ColorWordBoard
                    boardScope={boardScope}
                    phase={phase}
                    roundKey={roundKey}
                    wordName={word.name}
                    inkTextClass={ink.textClass}
                    onPick={judge}
                />
            </div>

            <ColorWordResult reveal={reveal} roundKey={roundKey} inkName={ink.name} />
            <ColorWordOverlays
                phase={phase}
                countdown={countdown}
                score={score}
                best={best}
                newBest={newBest}
                reveal={reveal}
                wordName={word.name}
                inkName={ink.name}
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
