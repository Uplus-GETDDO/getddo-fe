import pauseInUrl from '../assets/audio/sfx_sounds_pause7_in.wav';
import pauseOutUrl from '../assets/audio/sfx_sounds_pause7_out.wav';

/**
 * 게임 소리 하나 — 음원과 크기 배율, 필요하면 쓸 구간.
 * 음원마다 원본 크기가 달라 volume으로 맞춘다 — 효과음은 평균 크기 약 -20dB, 배경 음악은 약 -22dB가 되게 잡았다
 */
export interface GameSound {
    url: string;
    /** 크기 배율 (1이면 원본 그대로) */
    volume: number;
    /** 음원 앞부분을 건너뛰고 이 초부터 낸다 */
    start?: number;
    /** 이 초만큼만 내고 끝을 짧게 줄여 끊는다 */
    duration?: number;
}

/** 일시정지·이어 하기 소리 — 타꼬런·글자색깔 맞추기 공용 (원본 평균 약 -18dB) */
export const PAUSE_SOUNDS = {
    pause: { url: pauseInUrl, volume: 0.8 },
    resume: { url: pauseOutUrl, volume: 0.8 },
} as const satisfies Record<string, GameSound>;
