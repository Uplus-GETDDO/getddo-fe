// 플레이 화면이 있는 게임 — 게임 code별 구현은 ui/GamePlayer에서 고른다 (다른 게임은 만들면 여기에 더한다)
const PLAYABLE_GAME_CODES = new Set(['TAKKO_RUN', 'COLOR_WORD', 'TAKKO_TIMING', 'TAKKO_ORDER']);

export const hasGamePlayer = (code: string) => PLAYABLE_GAME_CODES.has(code);
