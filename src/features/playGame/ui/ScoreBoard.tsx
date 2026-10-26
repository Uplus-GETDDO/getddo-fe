import type { Ref } from 'react';

import scoreBoard from '../assets/ui/score-board.png';
import { PIXEL_FONT } from '../model/pixelFont';

/**
 * 점수판 (피그마 image 112) — 게임 중에는 높이 40(좁은 화면 28), 결과 화면에서는 48.
 * 숫자 칸 위치는 판 그림 안의 크림색 칸을 판 크기에 대한 비율로 잰 값이다.
 * 도트 글꼴은 글자 위쪽 여백이 커서 대문자 높이로 잘라(text-box) 세로 가운데를 맞춘다
 */
export function ScoreBoard({
    value,
    valueRef,
    size = 'small',
}: {
    value: string;
    /** 매 프레임 바뀌는 점수는 다시 그리지 않고 이 요소의 글자만 바꾼다 */
    valueRef?: Ref<HTMLSpanElement>;
    size?: 'small' | 'large';
}) {
    return (
        <div className={`relative shrink-0 ${size === 'large' ? 'h-12' : 'h-7 sm:h-10'}`}>
            <img src={scoreBoard} alt="" className="h-full w-auto" />
            <span className="sr-only">점수</span>
            <span
                ref={valueRef}
                className={`${PIXEL_FONT} text-status-revision-text absolute top-[28.4%] right-[6.1%] bottom-[25.9%] left-[26.9%] flex items-center justify-center leading-none tabular-nums [text-box:trim-both_cap_alphabetic] ${size === 'large' ? 'text-body' : 'text-caption sm:text-body-sm'}`}
            >
                {value}
            </span>
        </div>
    );
}
