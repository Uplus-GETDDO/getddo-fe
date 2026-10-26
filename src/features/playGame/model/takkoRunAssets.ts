import type { TakkoRunImageKey, TakkoRunImages } from '../utils/drawTakkoRun';
import type { GameSound } from './gameSounds';

import completeUrl from '../assets/audio/complete.wav';
import bgmUrl from '../assets/audio/flowerbed_fields.m4a';
import bellUrl from '../assets/audio/pleasing-bell.wav';
import jumpUrl from '../assets/audio/slime_jump.wav';
import characterUrl from '../assets/takkoRun/character.png';
import cloudsUrl from '../assets/takkoRun/clouds.png';
import lanternsUrl from '../assets/takkoRun/lanterns.png';
import saucesUrl from '../assets/takkoRun/sauces.png';
import skewersUrl from '../assets/takkoRun/skewers.png';
import skyUrl from '../assets/takkoRun/sky.jpg';
import stage2DecorUrl from '../assets/takkoRun/stage2/decor.webp';
import stage2GroundUrl from '../assets/takkoRun/stage2/ground.webp';
import stage2ObstaclesUrl from '../assets/takkoRun/stage2/obstacles.webp';
import stage2SkyUrl from '../assets/takkoRun/stage2/sky.jpg';
import stage2TownUrl from '../assets/takkoRun/stage2/town.webp';
import stage3DecorUrl from '../assets/takkoRun/stage3/decor.webp';
import stage3GroundUrl from '../assets/takkoRun/stage3/ground.webp';
import stage3ObstaclesUrl from '../assets/takkoRun/stage3/obstacles.webp';
import stage3SkyUrl from '../assets/takkoRun/stage3/sky.jpg';
import stage3TownUrl from '../assets/takkoRun/stage3/town.webp';
import stage4DecorUrl from '../assets/takkoRun/stage4/decor.webp';
import stage4GroundUrl from '../assets/takkoRun/stage4/ground-1.webp';
import stage4Ground2Url from '../assets/takkoRun/stage4/ground-2.webp';
import stage4ObstaclesUrl from '../assets/takkoRun/stage4/obstacles.webp';
import stage4SkyUrl from '../assets/takkoRun/stage4/sky.jpg';
import stage4TownUrl from '../assets/takkoRun/stage4/town.webp';
import starsUrl from '../assets/takkoRun/stars.png';
import townUrl from '../assets/takkoRun/town.png';

/** 배경 음악 — 원본 평균 약 -22dB라 그대로 쓴다 */
export const TAKKO_RUN_BGM: GameSound = { url: bgmUrl, volume: 1 };

/**
 * 효과음 — 점프, 스테이지가 바뀔 때, 게임이 끝날 때 (크기는 GameSound 기준에 맞춘 배율).
 * 점프는 원본이 아주 커서(약 -7dB) 줄이고, 종소리·완료음은 작아서 키운다
 */
export const TAKKO_RUN_SOUNDS = {
    jump: { url: jumpUrl, volume: 0.35 },
    stageUp: { url: bellUrl, volume: 3 },
    gameOver: { url: completeUrl, volume: 1.6 },
} as const satisfies Record<string, GameSound>;

const IMAGE_SOURCES: Record<TakkoRunImageKey, string> = {
    character: characterUrl,
    clouds: cloudsUrl,
    lanterns: lanternsUrl,
    sauces: saucesUrl,
    skewers: skewersUrl,
    sky: skyUrl,
    stars: starsUrl,
    town: townUrl,
    // 스테이지 2~4 배경·장애물 (피그마 image 123~143)
    stage2Decor: stage2DecorUrl,
    stage2Obstacles: stage2ObstaclesUrl,
    stage2Sky: stage2SkyUrl,
    stage2Town: stage2TownUrl,
    stage2Ground: stage2GroundUrl,
    stage3Decor: stage3DecorUrl,
    stage3Obstacles: stage3ObstaclesUrl,
    stage3Sky: stage3SkyUrl,
    stage3Town: stage3TownUrl,
    stage3Ground: stage3GroundUrl,
    stage4Decor: stage4DecorUrl,
    stage4Obstacles: stage4ObstaclesUrl,
    stage4Sky: stage4SkyUrl,
    stage4Town: stage4TownUrl,
    stage4Ground: stage4GroundUrl,
    stage4Ground2: stage4Ground2Url,
};

// 한 번 받은 그림은 다시 받지 않는다 — 썸네일 화면에서 미리 받아 두면 게임 시작이 바로 된다
let imagesPromise: Promise<TakkoRunImages> | null = null;

/** 게임 그림을 받아 풀어 둔다 (실패하면 다음에 다시 시도) */
export function loadTakkoRunImages(): Promise<TakkoRunImages> {
    imagesPromise ??= Promise.all(
        Object.entries(IMAGE_SOURCES).map(async ([key, src]) => {
            const image = new Image();
            image.src = src;
            await image.decode();
            return [key, image] as const;
        }),
    )
        .then((entries) => Object.fromEntries(entries) as TakkoRunImages)
        .catch((error: unknown) => {
            imagesPromise = null;
            throw error;
        });
    return imagesPromise;
}

/** 게임 그림과 배경 음악을 미리 받아 둔다 — 실패해도 게임을 열 때 다시 받으므로 조용히 넘긴다 */
export function preloadTakkoRun() {
    loadTakkoRunImages().catch(() => undefined);
    // 음악은 브라우저 캐시에 받아만 두고, 재생할 때 다시 요청하면 캐시에서 바로 온다
    fetch(TAKKO_RUN_BGM.url).catch(() => undefined);
}

/** 404 미니 달리기에 쓰는 그림 — 배경 없이 캐릭터와 장애물 시트만 */
export type TakkoRunSpriteKey =
    'character' | 'sauces' | 'skewers' | 'stage2Obstacles' | 'stage3Obstacles' | 'stage4Obstacles';
export type TakkoRunSprites = Record<TakkoRunSpriteKey, HTMLImageElement>;

let spritesPromise: Promise<TakkoRunSprites> | null = null;

/** 캐릭터·장애물 그림만 받는다 — 배경 그림(하늘·마을)은 받지 않아 가볍다 (실패하면 다음에 다시 시도) */
export function loadTakkoRunSprites(): Promise<TakkoRunSprites> {
    const keys: TakkoRunSpriteKey[] = [
        'character',
        'sauces',
        'skewers',
        'stage2Obstacles',
        'stage3Obstacles',
        'stage4Obstacles',
    ];
    spritesPromise ??= Promise.all(
        keys.map(async (key) => {
            const image = new Image();
            image.src = IMAGE_SOURCES[key];
            await image.decode();
            return [key, image] as const;
        }),
    )
        .then((entries) => Object.fromEntries(entries) as TakkoRunSprites)
        .catch((error: unknown) => {
            spritesPromise = null;
            throw error;
        });
    return spritesPromise;
}
