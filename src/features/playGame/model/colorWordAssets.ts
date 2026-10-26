import type { GameSound } from './gameSounds';

import completeUrl from '../assets/audio/complete.wav';
import bgmUrl from '../assets/audio/Peachtea - Somewhere in the Elevator.m4a';
import coinUrl from '../assets/audio/sfx_coin_cluster3.wav';
import damageUrl from '../assets/audio/sfx_sounds_damage1.wav';
import fallingUrl from '../assets/audio/sfx_sounds_falling7.wav';

/** 배경 음악 — Peachtea 'Somewhere in the Elevator' (원본 평균 약 -20dB라 조금 줄인다. ogg는 사파리에서 못 푸는 경우가 있어 m4a로 바꿔 쓴다) */
export const COLOR_WORD_BGM: GameSound = { url: bgmUrl, volume: 0.8 };

/** 효과음 — 맞혔을 때, 틀렸을 때, 시간이 지났을 때, 게임이 끝날 때 (크기는 GameSound 기준에 맞춘 배율) */
export const COLOR_WORD_SOUNDS = {
    correct: { url: coinUrl, volume: 0.45 },
    wrong: { url: damageUrl, volume: 0.9 },
    // 2.9초짜리라 잘 들리는 "뿌우" 내려가는 구간(0.8~1.6초)만 써서 다음 문제 전에 끝낸다
    timeUp: { url: fallingUrl, volume: 0.5, start: 0.8, duration: 0.8 },
    gameOver: { url: completeUrl, volume: 1.6 },
} as const satisfies Record<string, GameSound>;
