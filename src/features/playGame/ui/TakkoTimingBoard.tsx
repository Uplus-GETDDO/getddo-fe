import type { Ref } from 'react';

import { motion, type MotionValue } from 'framer-motion';

import type { TakkoTimingPhase, TakkoTimingReveal } from '../hooks/useTakkoTimingGame';
import type { TakkoTimingRound } from '../model/takkoTiming';

import mascotCorrect from '../assets/colorWord/mascot-correct.png';
import mascotIdle from '../assets/colorWord/mascot-idle.png';
import mascotWrong from '../assets/colorWord/mascot-wrong.png';
import gaugePin from '../assets/takkoTiming/gauge-pin.png';
import gaugeSparkle from '../assets/takkoTiming/gauge-sparkle.png';
import gaugeTrack from '../assets/takkoTiming/gauge-track.png';
import gaugeZone from '../assets/takkoTiming/gauge-zone.png';
import toothpick from '../assets/takkoTiming/toothpick.png';
import { isInteractive } from '../utils/isInteractive';
import { GameBoardButton } from './GameBoardButton';
import { GameSpeechBubble } from './GameSpeechBubble';

const percent = (value: number) => `${value * 100}%`;

/**
 * 카운터 위 게이지 길(image 195)에 타꼬가 서 있고, 이쑤시개가 위를 오간다. 판을 누르면 꽂는다(위 버튼 제외).
 * 실패하면 이 장면이 흔들린다. --bar는 게이지 굵기, --taco는 타꼬 너비.
 * 판 너비(cqw) 기준이라 판이 화면 높이에 맞춰 작아져도 같은 비율로 줄어든다 — 화면 너비(vw) 기준이면 넓고 낮은 화면에서 이쑤시개가 판 위로 잘렸다
 */
export function TakkoTimingBoard({
    boardScope,
    phase,
    round,
    roundKey,
    reveal,
    chip,
    runnerX,
    onJudge,
}: {
    /** 실패하면 이 장면이 좌우로 흔들린다 — 훅이 애니메이션을 걸 ref */
    boardScope: Ref<HTMLDivElement>;
    phase: TakkoTimingPhase;
    round: TakkoTimingRound;
    roundKey: number;
    reveal: TakkoTimingReveal | null;
    chip: string | null;
    /** 이쑤시개 위치 (0~1 → '0%'~'100%') — 매 프레임 바뀌므로 값만 옮긴다 */
    runnerX: MotionValue<string>;
    onJudge: () => void;
}) {
    const mascot = !reveal
        ? { key: 'idle', src: mascotIdle }
        : reveal.points > 0
          ? { key: 'correct', src: mascotCorrect }
          : { key: 'wrong', src: mascotWrong };

    return (
        <div
            ref={boardScope}
            className="absolute inset-0 cursor-pointer [--bar:min(3.5cqw,2.1rem)] [--taco:min(10cqw,6rem)]"
            onPointerDown={(event) => {
                if (isInteractive(event.target)) return;
                if (phase === 'playing') {
                    event.preventDefault();
                    onJudge();
                }
            }}
        >
            {/* 게이지 길 — 카운터 위 벽 앞(높이 약 60%)에 띄운다 */}
            <div className="absolute inset-x-[14%] top-[60%] h-(--bar) -translate-y-1/2">
                {/* 초록 길 — 양 끝 둥근 부분은 그대로, 가운데 점선은 이어 붙여 늘린다 */}
                <div
                    className="absolute inset-0 border-x-[calc(var(--bar)*0.5)] border-solid"
                    style={{
                        borderImage: `url(${gaugeTrack}) 0 44 fill / 0 calc(var(--bar) * 0.5) round`,
                    }}
                />
                {/* 금색 구간 — 타꼬가 서 있는 자리. 양 끝 주황 테두리는 그대로 두고 가운데만 늘린다 */}
                <motion.div
                    key={`zone-${roundKey}`}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="absolute inset-y-0 border-x-[calc(var(--bar)*0.25)] border-solid"
                    style={{
                        left: percent(round.center - round.width / 2),
                        width: percent(round.width),
                        borderImage: `url(${gaugeZone}) 0 24 fill / 0 calc(var(--bar) * 0.25) stretch`,
                    }}
                />
                {/* 퍼펙트 자리 표시 핀 — 금색 구간 가운데 아래 */}
                <img
                    src={gaugePin}
                    alt=""
                    aria-hidden
                    draggable={false}
                    className="pointer-events-none absolute top-full mt-0.5 h-[calc(var(--bar)*1.2)] w-auto -translate-x-1/2 [image-rendering:pixelated]"
                    style={{ left: percent(round.center) }}
                />
                {/* 빗나간 자리 — 꽂힌 곳에 빨간 세로 표시를 깜빡여 구간과 얼마나 떨어졌는지 보이게 한다 */}
                {reveal?.result === 'miss' && (
                    <motion.span
                        aria-hidden
                        initial={{ opacity: 0, scaleY: 0.4 }}
                        animate={{ opacity: [0, 1, 0.5, 1], scaleY: 1 }}
                        transition={{ duration: 0.6 }}
                        className="bg-semantic-error pointer-events-none absolute -top-[60%] z-20 h-[220%] w-1 -translate-x-1/2 rounded-full"
                        style={{ left: percent(reveal.stopped) }}
                    />
                )}
                {/* 결과 말풍선 — 타꼬 머리 위(꽂힌 이쑤시개 끝보다 위) */}
                {chip && (
                    <GameSpeechBubble
                        key={`bubble-${roundKey}`}
                        text={chip}
                        className="bottom-[calc(70%+var(--taco)*2)]"
                        style={{ left: percent(round.center) }}
                    />
                )}
                {/* 타꼬 — 금색 구간 가운데에 가만히 서서 기다린다. 판마다 자리가 바뀐다 */}
                <motion.img
                    key={`${roundKey}-${mascot.key}`}
                    src={mascot.src}
                    alt=""
                    aria-hidden
                    draggable={false}
                    initial={reveal ? { y: -6, scale: 0.9 } : { opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ type: 'spring', stiffness: 420, damping: 14 }}
                    className="pointer-events-none absolute bottom-[70%] w-(--taco) -translate-x-1/2 [image-rendering:pixelated]"
                    style={{ left: percent(round.center) }}
                />
                {/* 퍼펙트 — 타꼬 위에서 반짝임이 톡 터진다 */}
                {reveal?.result === 'perfect' && (
                    <motion.img
                        src={gaugeSparkle}
                        alt=""
                        aria-hidden
                        draggable={false}
                        initial={{ opacity: 0, scale: 0.3 }}
                        animate={{ opacity: [0, 1, 1, 0], scale: [0.3, 1.2, 1, 1.1] }}
                        transition={{ duration: 0.7 }}
                        className="pointer-events-none absolute bottom-[calc(70%+var(--taco)*0.55)] z-20 h-(--bar) w-auto -translate-x-[140%] [image-rendering:pixelated]"
                        style={{ left: percent(round.center) }}
                    />
                )}
                {/* 이쑤시개(피그마 image 196) — 타꼬 위를 좌우로 오가다가, 누르면 그 자리에서 아래로 콕 꽂힌다.
                    세로로 선 이쑤시개 그림(피그마 image 196)의 아래 끝이 이쑤시개 끝이다.
                    길 전체 폭의 틀을 위치만큼 옮겨, 그 왼쪽 끝에 붙은 이쑤시개가 따라가게 한다 */}
                <motion.div
                    aria-hidden
                    className="pointer-events-none absolute inset-0 z-10 will-change-transform"
                    style={{ x: runnerX }}
                >
                    <motion.div
                        className="absolute bottom-[calc(70%+var(--taco)*0.95)] left-0 h-[calc(var(--taco)*1.4)] -translate-x-1/2"
                        initial={false}
                        animate={{ y: reveal ? '32%' : '0%' }}
                        transition={
                            reveal
                                ? { duration: 0.08, ease: 'easeIn' }
                                : { type: 'spring', stiffness: 300, damping: 22 }
                        }
                    >
                        <img
                            src={toothpick}
                            alt=""
                            draggable={false}
                            className="h-full w-auto drop-shadow-md [image-rendering:pixelated]"
                        />
                    </motion.div>
                </motion.div>
            </div>

            {/* 꽂기 버튼 — 카운터 앞면 (버튼 자체는 relative라 감싸서 자리를 잡는다) */}
            <div className="absolute bottom-[3%] left-1/2 w-[min(30%,13rem)] -translate-x-1/2">
                <GameBoardButton
                    disabled={phase !== 'playing'}
                    onClick={() => onJudge()}
                    className="w-full justify-center gap-2 text-sm sm:text-base"
                >
                    지금 꽂기!
                    {/* 키 모양 — 글자색깔 맞추기 번호 키와 같은 모양 */}
                    <span
                        aria-hidden
                        className="border-fg-primary bg-surface-page text-caption rounded-md border-2 px-1.5 leading-5 font-extrabold shadow-[0_2px_0_0_var(--color-fg-primary)] [@media(hover:none)]:hidden"
                    >
                        Space
                    </span>
                </GameBoardButton>
            </div>
        </div>
    );
}
