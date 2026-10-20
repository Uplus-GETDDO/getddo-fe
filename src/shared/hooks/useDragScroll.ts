import type { MouseEvent, PointerEvent } from 'react';

import { useRef } from 'react';

/**
 * 가로 스크롤 목록을 마우스로 끌어서 넘길 수 있게 한다 (터치는 브라우저 기본 스크롤을 쓴다).
 * 끌다가 놓으면 그 속도로 조금 더 미끄러지고, 끈 뒤에 생기는 클릭은 안쪽 링크로 전달하지 않는다.
 * 반환값을 스크롤 영역 요소에 그대로 펼쳐 넣는다
 */
export function useDragScroll<T extends HTMLElement>() {
    const drag = useRef<{
        startX: number;
        scrollLeft: number;
        dragged: boolean;
        lastX: number;
        lastT: number;
        velocity: number;
    } | null>(null);
    const momentum = useRef<number | null>(null);
    const suppressClick = useRef(false);

    const stopMomentum = () => {
        if (momentum.current == null) return;
        cancelAnimationFrame(momentum.current);
        momentum.current = null;
    };

    const startMomentum = (el: T, initial: number) => {
        let v = Math.max(-40, Math.min(40, initial));
        const step = () => {
            if (Math.abs(v) < 0.3) {
                momentum.current = null;
                return;
            }
            el.scrollLeft += v;
            v *= 0.94;
            momentum.current = requestAnimationFrame(step);
        };
        momentum.current = requestAnimationFrame(step);
    };

    return {
        onPointerDown: (e: PointerEvent<T>) => {
            if (e.pointerType !== 'mouse' || e.button !== 0) return;
            stopMomentum();
            drag.current = {
                startX: e.clientX,
                scrollLeft: e.currentTarget.scrollLeft,
                dragged: false,
                lastX: e.clientX,
                lastT: e.timeStamp,
                velocity: 0,
            };
        },
        onPointerMove: (e: PointerEvent<T>) => {
            const d = drag.current;
            if (!d) return;
            const dx = e.clientX - d.startX;
            if (!d.dragged) {
                if (Math.abs(dx) < 4) return;
                d.dragged = true;
                e.currentTarget.setPointerCapture(e.pointerId);
            }
            const dt = e.timeStamp - d.lastT;
            if (dt > 0) {
                // 최근 이동 속도(px/프레임)를 부드럽게 평균 내 놓을 때 관성에 쓴다
                d.velocity = d.velocity * 0.7 + ((d.lastX - e.clientX) / dt) * 16 * 0.3;
                d.lastX = e.clientX;
                d.lastT = e.timeStamp;
            }
            e.currentTarget.scrollLeft = d.scrollLeft - dx;
        },
        onPointerUp: (e: PointerEvent<T>) => {
            if (drag.current?.dragged) {
                suppressClick.current = true;
                startMomentum(e.currentTarget, drag.current.velocity);
            }
            drag.current = null;
        },
        onPointerCancel: () => {
            drag.current = null;
        },
        onClickCapture: (e: MouseEvent<T>) => {
            if (!suppressClick.current) return;
            e.preventDefault();
            e.stopPropagation();
            suppressClick.current = false;
        },
    };
}
