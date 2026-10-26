import { preloadTakkoRun } from '../model/takkoRunAssets';

/** 플레이 화면이 있는 게임의 그림·소리를 미리 받아 둔다 (게임 상세의 썸네일 화면에서 부른다) */
export function preloadGamePlayer(code: string) {
    if (code === 'TAKKO_RUN') preloadTakkoRun();
}
