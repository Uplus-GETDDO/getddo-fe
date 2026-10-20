import { useEffect, useRef, useState } from 'react';

/**
 * 값이 바뀌면 지금 화면에 보이는 값에서 새 값까지 숫자를 굴려 올린다.
 * - 기본: 처음 받은 값은 그대로 보여주고, 그 뒤에 값이 바뀔 때만 굴린다 (예: 출석 후 응모권 +1)
 * - fromZero: 처음 받은 값도 0부터 굴려 올린다 (예: 화면 진입 시 최고점)
 * 출발점을 '화면에 보이는 값'으로 잡아서, 효과가 두 번 실행돼도(개발 모드 StrictMode) 처음부터 다시 굴린다.
 * 동작 줄이기 설정을 켠 사용자에게는 바로 새 값을 보여준다
 */
export function useCountUp(
    value: number | undefined,
    { fromZero = false, durationMs = 600 }: { fromZero?: boolean; durationMs?: number } = {},
): number | undefined {
    const [display, setDisplay] = useState(fromZero && value != null ? 0 : value);
    const shown = useRef(display);

    useEffect(() => {
        const show = (next: number | undefined) => {
            shown.current = next;
            setDisplay(next);
        };
        const from = shown.current ?? (fromZero ? 0 : undefined);
        if (value == null || from == null || from === value) {
            show(value);
            return;
        }
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
            show(value);
            return;
        }
        const start = performance.now();
        let frame = requestAnimationFrame(function step(time) {
            const progress = Math.min(1, (time - start) / durationMs);
            const eased = 1 - (1 - progress) ** 3;
            show(Math.round(from + (value - from) * eased));
            if (progress < 1) frame = requestAnimationFrame(step);
        });
        return () => cancelAnimationFrame(frame);
    }, [value, durationMs, fromZero]);

    return display;
}
