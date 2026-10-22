import type { CSSProperties } from 'react';

import { motion } from 'framer-motion';

import { PIXEL_FONT } from '../model/pixelFont';

/**
 * 결과 말풍선 — 캐릭터 머리 위에 뜨는 도트 말풍선 (타꼬 타이밍·글자색깔 맞추기 공용).
 * 색 대신 게임 그림체(크림 바탕·진한 갈색 테두리·도트 글꼴·도트 그림자)로 맞추고, 아래 꼬리가 캐릭터를 가리킨다.
 * 위치는 쓰는 쪽이 className·style로 정한다 (말풍선 아래 가운데가 기준점)
 */
export function GameSpeechBubble({
    text,
    className = '',
    style,
}: {
    text: string;
    className?: string;
    style?: CSSProperties;
}) {
    return (
        <motion.div
            aria-hidden
            initial={{ opacity: 0, y: 6, scale: 0.8 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ type: 'spring', stiffness: 460, damping: 18 }}
            className={`pointer-events-none absolute z-20 origin-bottom -translate-x-1/2 ${className}`}
            style={style}
        >
            <span
                className={`border-fg-primary bg-ticket-accent text-fg-primary relative block rounded-md border-[3px] px-3 py-1.5 text-sm whitespace-nowrap shadow-[3px_3px_0_0_var(--color-fg-primary)] @md:text-base @lg:px-4 @lg:py-2 @lg:text-xl ${PIXEL_FONT}`}
            >
                {text}
                {/* 꼬리 — 테두리색 삼각형 위에 바탕색 삼각형을 겹쳐 도트 테두리처럼 */}
                <span className="bg-fg-primary absolute top-full left-1/2 size-3 -translate-x-1/2 [clip-path:polygon(0_0,100%_0,50%_100%)]" />
                <span className="bg-ticket-accent absolute top-full left-1/2 -mt-[3px] size-2 -translate-x-1/2 [clip-path:polygon(0_0,100%_0,50%_100%)]" />
            </span>
        </motion.div>
    );
}
