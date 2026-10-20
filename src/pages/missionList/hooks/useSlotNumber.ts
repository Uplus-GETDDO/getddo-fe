import { useEffect, useState } from 'react';

/** 무작위 숫자를 바꿔 보여 주는 간격(ms) */
const TICK_MS = 60;

/**
 * 슬롯머신처럼 무작위 숫자가 잠깐 돌다가 실제 값에 멈춘다.
 * 0→9처럼 작은 수를 세어 올리면 너무 빨리 끝나 어색해서, 작은 수도 같은 시간 동안 굴린다.
 * 값이 처음 정해질 때와 바뀔 때마다 돌고, 동작 줄이기 설정이면 돌지 않는다.
 * 무작위 숫자는 실제 값과 같은 자릿수 안에서 고른다 (글자 폭이 흔들리지 않게)
 */
export function useSlotNumber(value: number, durationMs = 800): number {
    // 도는 동안 보여 줄 무작위 숫자 — null이면 실제 값을 보여 준다
    const [rolling, setRolling] = useState<number | null>(null);

    useEffect(() => {
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
        const max = 10 ** Math.max(1, String(value).length);
        const timer = setInterval(() => setRolling(Math.floor(Math.random() * max)), TICK_MS);
        const stop = setTimeout(() => {
            clearInterval(timer);
            setRolling(null);
        }, durationMs);
        return () => {
            clearInterval(timer);
            clearTimeout(stop);
            // 도는 중에 값이 바뀌어 다음 effect가 동작 줄이기로 돌지 않으면, 남은 무작위 숫자가 그대로 굳지 않게 지운다
            setRolling(null);
        };
    }, [value, durationMs]);

    return rolling ?? value;
}
