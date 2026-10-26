import type { TakkoOrderGameProps } from '../hooks/useTakkoOrderGame';

import { useTakkoOrderGame } from '../hooks/useTakkoOrderGame';
import { TAKKO_ORDER_LIVES, TAKKO_ORDER_MIN_REWARD_SCORE } from '../model/takkoOrder';
import { TAKKO_ORDER_WALL } from '../model/takkoOrderAssets';
import { GameImageButton } from './GameImageButton';
import { GameLives } from './GameOverlays';
import { GameRewardProgress } from './GameRewardProgress';
import { ScoreBoard } from './ScoreBoard';
import { TakkoOrderBubble } from './TakkoOrderBubble';
import { TakkoOrderMenu } from './TakkoOrderMenu';
import { TakkoOrderOverlays } from './TakkoOrderOverlays';
import { TakkoOrderPlate } from './TakkoOrderPlate';
import { TakkoOrderScene } from './TakkoOrderScene';
import { VolumeControl } from './VolumeControl';

const padScore = (score: number) => String(score).padStart(5, '0');

/**
 * 타꼬 주문 — 손님 주문(타코야끼 순서)을 잠깐 보여 주고 가린 뒤, 아래 메뉴 버튼으로 같은 순서대로 내준다 (키보드 1~4도 된다).
 * 상태·타이머·판정은 useTakkoOrderGame, 장면·말풍선·메뉴·오버레이는 같은 폴더의 TakkoOrder* 컴포넌트가 그린다
 */
export function TakkoOrderGame(props: TakkoOrderGameProps) {
    const { onExit } = props;
    const {
        phase,
        countdown,
        order,
        picked,
        ok,
        lives,
        score,
        best,
        newBest,
        customer,
        customerSrc,
        line,
        slotSize,
        playing,
        showOrder,
        showMs,
        showTotal,
        rewardOpen,
        setRewardOpen,
        ticketsGranted,
        rewardGrade,
        boardScope,
        restartRef,
        bgm,
        start,
        pick,
        undo,
        pause,
        resume,
    } = useTakkoOrderGame(props);

    return (
        <div
            // 타코야끼 가게 — 타꼬 타이밍과 같은 들보·미색 벽에 노렌·문어 장식·선반, 아래 나무 카운터(그림이라 다크에서도 라이트 색)
            className="force-light border-fg-primary @container relative aspect-[840/546] w-full overflow-hidden rounded-2xl border-2 bg-cover bg-top shadow-md select-none"
            style={{ backgroundImage: `url(${TAKKO_ORDER_WALL.wall})` }}
        >
            <TakkoOrderScene
                showCustomer={playing || phase === 'over'}
                customer={customer}
                customerSrc={customerSrc}
            />

            {/* 보상 기준까지 남은 점수 — 점수판 아래, 말풍선보다 먼저 그린다 */}
            {phase !== 'ready' && (
                <GameRewardProgress score={score} goal={TAKKO_ORDER_MIN_REWARD_SCORE} />
            )}

            <TakkoOrderBubble
                boardScope={boardScope}
                phase={phase}
                ok={ok}
                customer={customer}
                lives={lives}
                line={line}
                order={order}
                picked={picked}
                showOrder={showOrder}
                showMs={showMs}
                showTotal={showTotal}
                slotSize={slotSize}
                visible={playing}
            />
            <TakkoOrderPlate
                customer={customer}
                lives={lives}
                orderLength={order.length}
                picked={picked}
            />

            {/* 위 — 나가기·소리 · 목숨 · 점수판 */}
            <div
                className={`absolute inset-x-0 top-0 flex items-start justify-between gap-3 p-3 ${phase === 'over' ? '' : 'z-10'}`}
            >
                <div className="flex items-start gap-2 sm:gap-3">
                    <GameImageButton kind="exit" size="small" onClick={onExit} />
                    <VolumeControl level={bgm.level} onLevelChange={bgm.setLevel} />
                    {(phase === 'showing' ||
                        phase === 'input' ||
                        phase === 'countdown' ||
                        phase === 'reveal' ||
                        phase === 'paused') && (
                        <GameImageButton
                            kind="pause"
                            size="small"
                            onClick={phase === 'paused' ? resume : pause}
                        />
                    )}
                </div>
                <GameLives lives={lives} max={TAKKO_ORDER_LIVES} />
                <ScoreBoard value={padScore(score)} />
            </div>

            <TakkoOrderMenu
                phase={phase}
                ok={ok}
                lives={lives}
                pickedEmpty={picked.length === 0}
                onPick={pick}
                onUndo={undo}
            />
            <TakkoOrderOverlays
                phase={phase}
                ok={ok}
                countdown={countdown}
                score={score}
                best={best}
                newBest={newBest}
                order={order}
                pickedCount={picked.length}
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
