import type { Ref } from 'react';

import { motion } from 'framer-motion';

import type { ColorWordPhase } from '../hooks/useColorWordGame';
import type { ColorWordColorId } from '../model/colorWord';

import wordBoard from '../assets/colorWord/word-board.png';
import { COLOR_WORD_COLORS } from '../model/colorWord';
import { ColorWordButton } from './ColorWordButton';

/**
 * 가운데 판 — 글자판(image 170) 안에 글자, 아래에 색 버튼 2×2. 틀리면 이 부분이 흔들린다
 */
export function ColorWordBoard({
    boardScope,
    phase,
    roundKey,
    wordName,
    inkTextClass,
    onPick,
}: {
    /** 틀리면 이 부분이 좌우로 흔들린다 — 훅이 애니메이션을 걸 ref */
    boardScope: Ref<HTMLDivElement>;
    phase: ColorWordPhase;
    /** 한 문제마다 바뀌는 번호 — 글자 등장 연출을 처음부터 다시 한다 */
    roundKey: number;
    /** 글자 뜻 */
    wordName: string;
    /** 글자에 칠한 색(정답)의 글자색 클래스 */
    inkTextClass: string;
    onPick: (id: ColorWordColorId) => void;
}) {
    // 시작 안내·세는 동안·멈춘 동안에는 글자를 가려 미리 볼 수 없게 한다
    const wordOpacity = phase === 'playing' || phase === 'over' ? 1 : 0;

    return (
        <div
            ref={boardScope}
            className="flex flex-1 flex-col items-center justify-center gap-[2%] px-3 pb-[12%]"
        >
            <div className="relative flex aspect-[900/229] w-[min(64%,34rem)] items-center justify-center">
                <img
                    src={wordBoard}
                    alt=""
                    draggable={false}
                    className="pointer-events-none absolute inset-0 size-full"
                />
                {/* 맞히면 다음 글자가 살짝 커지며 나온다. 기본 고딕(프리텐다드) 가장 굵게, 테두리·그림자 없이 깔끔하게.
                    판 그림의 크림색 안쪽이 아래로 치우쳐 있어(높이 28~84%) 글자를 6% 내려 가운데에 맞춘다 */}
                <motion.p
                    key={roundKey}
                    initial={{ opacity: 0, scale: 0.85 }}
                    animate={{ opacity: wordOpacity, scale: 1 }}
                    transition={{ duration: 0.15 }}
                    className={`relative top-[6%] text-[clamp(1.25rem,6.25cqw,3.75rem)] leading-none font-black tracking-tight ${inkTextClass}`}
                >
                    {wordName}
                </motion.p>
            </div>

            {/* 색 버튼 — 번호는 키보드 단축키 */}
            <div className="grid w-[min(64%,34rem)] grid-cols-2 gap-x-[3%] gap-y-2">
                {COLOR_WORD_COLORS.map((color, index) => (
                    <ColorWordButton
                        key={color.id}
                        number={index + 1}
                        name={color.name}
                        textClass={color.textClass}
                        disabled={phase !== 'playing'}
                        onPick={() => onPick(color.id)}
                    />
                ))}
            </div>
        </div>
    );
}
