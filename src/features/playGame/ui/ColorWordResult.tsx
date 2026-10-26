import { motion } from 'framer-motion';

import type { ColorWordReveal } from '../hooks/useColorWordGame';

import mascotCorrect from '../assets/colorWord/mascot-correct.png';
import mascotIdle from '../assets/colorWord/mascot-idle.png';
import mascotWrong from '../assets/colorWord/mascot-wrong.png';
import { GameSpeechBubble } from './GameSpeechBubble';

/**
 * 답을 고른 뒤 잠깐 보이는 결과 표시 — 오른쪽 아래 타코야끼 표정, 머리 위 결과 말풍선, 판 테두리 초록·빨강
 */
export function ColorWordResult({
    reveal,
    roundKey,
    inkName,
}: {
    reveal: ColorWordReveal | null;
    roundKey: number;
    /** 글자에 칠한 색(정답)의 이름 — 틀리면 정답을 알려 준다 */
    inkName: string;
}) {
    const mascot = !reveal
        ? { key: 'idle', src: mascotIdle }
        : reveal.ok
          ? { key: 'correct', src: mascotCorrect }
          : { key: 'wrong', src: mascotWrong };

    return (
        <>
            {/* 오른쪽 아래 타코야끼 — 평소(image 167) · 맞히면 기뻐하고(image 168) · 틀리거나 시간이 지나면 당황한다(image 169). 몸 아래는 판 밖으로 잘린다 */}
            <motion.img
                key={mascot.key}
                src={mascot.src}
                alt=""
                aria-hidden
                draggable={false}
                initial={reveal ? { y: 8, scale: 0.94 } : false}
                animate={{ y: 0, scale: 1 }}
                transition={{ type: 'spring', stiffness: 420, damping: 16 }}
                className="pointer-events-none absolute right-0 -bottom-[5%] w-[24%] origin-bottom [image-rendering:pixelated]"
            />

            {/* 결과 말풍선 — 오른쪽 아래 타코야끼 머리 위 */}
            {reveal && (
                <GameSpeechBubble
                    key={`bubble-${roundKey}`}
                    text={
                        reveal.ok
                            ? '정답!'
                            : reveal.picked === null
                              ? '시간 초과!'
                              : `땡! 정답은 ${inkName}`
                    }
                    className="bottom-[25%] left-[85%]"
                />
            )}

            {/* 맞힘·틀림 — 게임 판 테두리만 두껍게 초록·빨강으로 바꾼다 (판 안쪽 색 덮기·버튼 테두리는 두지 않는다) */}
            {reveal && (
                <motion.div
                    aria-hidden
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.12 }}
                    className={`pointer-events-none absolute inset-0 rounded-[inherit] border-[6px] ${reveal.ok ? 'border-semantic-success' : 'border-semantic-error'}`}
                />
            )}
        </>
    );
}
