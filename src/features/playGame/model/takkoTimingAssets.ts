import type { GameSound } from './gameSounds';

import completeUrl from '../assets/audio/complete.wav';
import bgmUrl from '../assets/audio/flowerbed_fields.m4a';
import bellUrl from '../assets/audio/pleasing-bell.wav';
import coinUrl from '../assets/audio/sfx_coin_cluster3.wav';
import damageUrl from '../assets/audio/sfx_sounds_damage1.wav';
import fallingUrl from '../assets/audio/sfx_sounds_falling7.wav';

/** 배경 음악 — 전용 곡이 나오기 전까지 타꼬런 곡을 같이 쓴다 (원본 평균 약 -22dB라 그대로) */
export const TAKKO_TIMING_BGM: GameSound = { url: bgmUrl, volume: 1 };

/**
 * 효과음 — 성공·퍼펙트·실패·시간 초과·게임 끝 (글자색깔 맞추기와 같은 음원, 크기는 GameSound 기준 배율).
 * 퍼펙트는 성공 소리에 종소리를 겹쳐 더 반짝이게 한다
 */
export const TAKKO_TIMING_SOUNDS = {
    hit: { url: coinUrl, volume: 0.45 },
    perfect: { url: bellUrl, volume: 3 },
    miss: { url: damageUrl, volume: 0.9 },
    // 2.9초짜리라 잘 들리는 "뿌우" 내려가는 구간(0.8~1.6초)만 써서 다음 판 전에 끝낸다
    timeUp: { url: fallingUrl, volume: 0.5, start: 0.8, duration: 0.8 },
    gameOver: { url: completeUrl, volume: 1.6 },
} as const satisfies Record<string, GameSound>;
